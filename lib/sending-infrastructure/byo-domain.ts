import "server-only";
import { prisma } from "@/lib/db/prisma";
import { assignManagedDomain, auditDomain, parseDomain } from "@/lib/managed-domains/service";
import { enforceAllowance } from "./readiness";
import { getWorkspaceEffectiveEntitlements } from "./operational";
import { getSendingGates, isSesIdentityVerified, unavailableMessage } from "./gates";
import { pollSesDomainIdentity, requestSesDomainIdentity } from "./ses-identity";
import { dnsValueMatches, lookupDnsRecord } from "./dns-observe";

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function normalizeDomainName(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
}

function requiredRecords(domainName: string, verificationToken: string, dkimTokens: string[]) {
  const records = [
    { type: "TXT", name: domainName, value: "v=spf1 include:amazonses.com ~all", purpose: "SPF" as const, ttl: 300 },
    { type: "TXT", name: `_dmarc.${domainName}`, value: "v=DMARC1; p=none; rua=mailto:dmarc@quantumreach.app", purpose: "DMARC" as const, ttl: 300 },
  ];
  if (verificationToken) {
    records.push({ type: "TXT", name: `_amazonses.${domainName}`, value: verificationToken, purpose: "SES_VERIFICATION" as const, ttl: 300 });
  }
  for (const token of dkimTokens) {
    records.push({
      type: "CNAME",
      name: `${token}._domainkey.${domainName}`,
      value: `${token}.dkim.amazonses.com`,
      purpose: "DKIM" as const,
      ttl: 300,
    });
  }
  return records;
}

export async function addByoDomain(input: { workspaceId: string; actorUserId: string; domainName: string }) {
  const domainName = normalizeDomainName(input.domainName);
  if (!DOMAIN_RE.test(domainName)) throw new Error("Enter a valid domain like example.com.");
  const { effective } = await getWorkspaceEffectiveEntitlements(input.workspaceId);
  const used = await prisma.managedDomain.count({ where: { workspaceId: input.workspaceId } });
  const allowance = enforceAllowance("domain", effective, used);
  if (!allowance.allowed) {
    const allowed = Number((effective as { MANAGED_DOMAIN_ALLOWANCE?: number }).MANAGED_DOMAIN_ALLOWANCE || 0);
    throw new Error(
      allowed
        ? `Your plan allows ${allowed} sending domain${allowed === 1 ? "" : "s"}. Upgrade or remove a domain to connect another.`
        : "Your plan does not include a sending domain yet. Upgrade to connect a domain.",
    );
  }

  const existing = await prisma.managedDomain.findUnique({ where: { domainName } });
  if (existing && existing.workspaceId && existing.workspaceId !== input.workspaceId) {
    throw new Error("That domain is already attached to another workspace.");
  }

  const parsed = parseDomain(domainName);
  const domain = existing
    ? existing
    : await prisma.managedDomain.create({
        data: {
          ...parsed,
          ownershipType: "WORKSPACE_OWNED",
          workspaceId: input.workspaceId,
          lifecycleStatus: "DNS_PENDING",
          assignedAt: new Date(),
          assignedByUserId: input.actorUserId,
        },
      });

  if (domain.workspaceId !== input.workspaceId) {
    await assignManagedDomain(domain.id, input.workspaceId, input.actorUserId, "BROUGHT_BY_WORKSPACE");
  } else {
    const assignment = await prisma.managedDomainAssignment.findFirst({
      where: { domainId: domain.id, workspaceId: input.workspaceId, status: "ACTIVE" },
    });
    if (!assignment) {
      await prisma.managedDomainAssignment.create({
        data: {
          domainId: domain.id,
          workspaceId: input.workspaceId,
          assignedByUserId: input.actorUserId,
          assignmentType: "BROUGHT_BY_WORKSPACE",
        },
      });
    }
  }

  const gates = getSendingGates();
  let verificationToken = "";
  let dkimTokens: string[] = [];
  let sesError: string | null = null;
  if (gates.sesConfigured) {
    const requested = await requestSesDomainIdentity(domainName);
    if ("error" in requested) sesError = requested.error;
    else {
      verificationToken = requested.verificationToken;
      dkimTokens = requested.dkimTokens;
    }
  } else {
    sesError = unavailableMessage("SES domain identity");
  }

  await prisma.domainSesIdentity.upsert({
    where: { domainId: domain.id },
    update: {
      sesRegion: gates.sesRegion,
      configurationSet: gates.configurationSet,
      verificationStatus: sesError ? "PENDING" : "PENDING",
      dkimStatus: "PENDING",
      lastSyncedAt: new Date(),
      safeError: sesError,
    },
    create: {
      domainId: domain.id,
      sesRegion: gates.sesRegion,
      configurationSet: gates.configurationSet,
      verificationStatus: "PENDING",
      dkimStatus: "PENDING",
      safeError: sesError,
    },
  });

  const desired = requiredRecords(domainName, verificationToken, dkimTokens);
  for (const record of desired) {
    const found = await prisma.domainDnsRecord.findFirst({
      where: { domainId: domain.id, type: record.type, name: record.name, purpose: record.purpose },
    });
    if (found) {
      await prisma.domainDnsRecord.update({
        where: { id: found.id },
        data: { value: record.value, status: "REQUIRED", ttl: record.ttl, safeError: null },
      });
    } else {
      await prisma.domainDnsRecord.create({ data: { domainId: domain.id, ...record, status: "REQUIRED" } });
    }
  }

  await auditDomain(domain.id, "byo_added", `BYO domain ${domainName} added. SES ${sesError ? "not configured" : "identity requested"}.`, input.workspaceId, input.actorUserId);
  return prisma.managedDomain.findUniqueOrThrow({ where: { id: domain.id }, include: { dnsRecords: true, sesIdentity: true } });
}

export async function verifyByoDomain(input: { workspaceId: string; domainId: string; actorUserId?: string | null }) {
  const domain = await prisma.managedDomain.findFirst({
    where: {
      id: input.domainId,
      OR: [{ workspaceId: input.workspaceId }, { assignments: { some: { workspaceId: input.workspaceId, status: "ACTIVE" } } }],
    },
    include: { dnsRecords: true, sesIdentity: true },
  });
  if (!domain) throw new Error("Domain is not assigned to this workspace.");

  for (const record of domain.dnsRecords) {
    const observed = await lookupDnsRecord(record.type, record.name);
    const ok = !observed.error && dnsValueMatches(record.value, observed.values);
    await prisma.domainDnsRecord.update({
      where: { id: record.id },
      data: {
        status: ok ? "VERIFIED" : observed.error === "ENOTFOUND" || observed.error === "ENODATA" ? "PENDING" : "FAILED",
        lastCheckedAt: new Date(),
        safeError: ok ? null : observed.error ?? "VALUE_MISMATCH",
      },
    });
  }

  let verificationStatus = domain.sesIdentity?.verificationStatus ?? "PENDING";
  let dkimStatus = domain.sesIdentity?.dkimStatus ?? "PENDING";
  let sesError = domain.sesIdentity?.safeError ?? null;
  const gates = getSendingGates();
  if (gates.sesConfigured) {
    const poll = await pollSesDomainIdentity(domain.domainName);
    if ("error" in poll) sesError = poll.error;
    else {
      verificationStatus = poll.verificationStatus;
      dkimStatus = poll.dkimStatus;
      sesError = null;
    }
  } else {
    sesError = unavailableMessage("SES verification");
  }

  await prisma.domainSesIdentity.upsert({
    where: { domainId: domain.id },
    update: { verificationStatus, dkimStatus, lastSyncedAt: new Date(), safeError: sesError, sesRegion: gates.sesRegion },
    create: { domainId: domain.id, verificationStatus, dkimStatus, lastSyncedAt: new Date(), safeError: sesError, sesRegion: gates.sesRegion },
  });

  const verified = isSesIdentityVerified(verificationStatus) && isSesIdentityVerified(dkimStatus);
  const nextStatus = verified ? "WARMING" : sesError ? "DNS_PENDING" : "SES_PENDING";
  await prisma.managedDomain.update({ where: { id: domain.id }, data: { lifecycleStatus: nextStatus } });
  await auditDomain(
    domain.id,
    verified ? "ses_verified" : "verify_checked",
    verified ? `Domain ${domain.domainName} SES + DKIM verified.` : `Verify checked. SES=${verificationStatus} DKIM=${dkimStatus}.`,
    input.workspaceId,
    input.actorUserId ?? undefined,
  );

  return {
    verified,
    verificationStatus,
    dkimStatus,
    reason: verified ? null : sesError || "Publish the DNS records below, then verify again. This can take a few minutes.",
  };
}

export async function operatorForceDomainStatus(input: {
  domainId: string;
  actorUserId: string;
  verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
  dkimStatus: "VERIFIED" | "PENDING" | "FAILED";
  note: string;
}) {
  if (input.note.trim().length < 8) throw new Error("An audit note is required.");
  const domain = await prisma.managedDomain.findUniqueOrThrow({ where: { id: input.domainId } });
  const gates = getSendingGates();
  await prisma.domainSesIdentity.upsert({
    where: { domainId: domain.id },
    update: { verificationStatus: input.verificationStatus, dkimStatus: input.dkimStatus, lastSyncedAt: new Date(), safeError: `OPERATOR_FORCE: ${input.note.trim()}` },
    create: {
      domainId: domain.id,
      sesRegion: gates.sesRegion,
      verificationStatus: input.verificationStatus,
      dkimStatus: input.dkimStatus,
      lastSyncedAt: new Date(),
      safeError: `OPERATOR_FORCE: ${input.note.trim()}`,
    },
  });
  const verified = isSesIdentityVerified(input.verificationStatus) && isSesIdentityVerified(input.dkimStatus);
  await prisma.managedDomain.update({ where: { id: domain.id }, data: { lifecycleStatus: verified ? "WARMING" : "SES_PENDING" } });
  await prisma.auditLog.create({
    data: {
      workspaceId: domain.workspaceId,
      actorId: input.actorUserId,
      action: "DOMAIN_STATUS_FORCED",
      entityType: "ManagedDomain",
      entityId: domain.id,
      metadata: { verificationStatus: input.verificationStatus, dkimStatus: input.dkimStatus, note: input.note.trim() },
    },
  });
  await auditDomain(domain.id, "operator_force", input.note.trim(), domain.workspaceId, input.actorUserId);
  return { verified };
}
