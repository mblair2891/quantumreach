/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
import { getDomainProvider } from "./providers";
import {
  toRegistrantSnapshot,
  validateRegistrantContact,
  type OwnershipType,
} from "./registrant";
export async function upsertDomainRegistrantProfile(input: any) {
  const normalizedInput = {
    ...input,
    countryCode: input.countryCode?.toUpperCase(),
    email: input.email?.toLowerCase(),
  };
  const valid = validateRegistrantContact(normalizedInput);
  if (!valid.complete)
    throw new Error(
      `Registrant profile is incomplete: ${valid.missing.join(", ")}.`,
    );
  return (prisma as any).domainRegistrantProfile.upsert({
    where: { workspaceId: input.workspaceId },
    create: {
      ...input,
      email: input.email.toLowerCase(),
      countryCode: input.countryCode.toUpperCase(),
    },
    update: {
      ...input,
      email: input.email.toLowerCase(),
      countryCode: input.countryCode.toUpperCase(),
    },
  });
}
export async function confirmDomainRegistrantProfile(
  workspaceId: string,
  confirmedByUserId: string,
) {
  return (prisma as any).domainRegistrantProfile.update({
    where: { workspaceId },
    data: { confirmedAt: new Date(), confirmedByUserId },
  });
}
export async function getDomainRegistrantProfile(workspaceId: string) {
  return (prisma as any).domainRegistrantProfile.findUnique({
    where: { workspaceId },
  });
}
export async function createDomainPurchaseRequest(input: {
  requestedDomain: string;
  workspaceId?: string;
  requestedByUserId?: string;
  adminBypass?: boolean;
  ownershipType?: OwnershipType;
  registrantAttestationAccepted?: boolean;
}) {
  const ownershipType = input.ownershipType || "WORKSPACE_OWNED";
  const provider = getDomainProvider();
  const quote = await provider.getDomainQuote(input.requestedDomain);
  let snapshot: any;
  if (ownershipType === "WORKSPACE_OWNED") {
    if (!input.workspaceId)
      throw new Error("Workspace-owned purchases require a workspace.");
    const profile = await (prisma as any).domainRegistrantProfile.findUnique({
      where: { workspaceId: input.workspaceId },
    });
    const valid = validateRegistrantContact(profile);
    if (!valid.complete)
      throw new Error(
        `Registrant profile is incomplete: ${valid.missing.join(", ")}.`,
      );
    if (!profile.confirmedAt || !input.registrantAttestationAccepted)
      throw new Error(
        "Registrant accuracy and authorization attestation is required before purchase.",
      );
    snapshot = toRegistrantSnapshot(profile);
  }
  return (prisma as any).domainPurchaseRequest.create({
    data: {
      workspaceId: input.workspaceId,
      requestedByUserId: input.requestedByUserId,
      requestedDomain: input.requestedDomain.toLowerCase(),
      ownershipType,
      registrantAttestationAccepted: !!input.registrantAttestationAccepted,
      registrantAttestationText: input.registrantAttestationAccepted
        ? "registrant accurate; authorized Quantum Reach registrar management; reseller/service-provider acknowledged"
        : null,
      status: quote.ok ? "QUOTED" : "DRAFT",
      estimatedCostCents: quote.data?.estimatedCostCents,
      resalePriceCents: quote.data?.resalePriceCents,
      providerQuoteId: quote.data?.providerQuoteId,
      safeError: quote.safeError,
      registrantSnapshot: snapshot ? { create: snapshot } : undefined,
    },
  });
}
export async function approveDomainPurchaseRequest(
  id: string,
  approvedByUserId: string,
) {
  return (prisma as any).domainPurchaseRequest.update({
    where: { id },
    data: { status: "APPROVED", approvedByUserId },
  });
}
export function getManagedPurchasingReadiness() {
  const enabled = process.env.DOMAIN_PURCHASING_ENABLED === "true";
  const provider = getDomainProvider();
  const configured = provider.isConfigured();
  return {
    enabled,
    configured,
    ready: enabled && configured,
    providerName: provider.name,
    reason: !enabled
      ? "Managed registration is not available in this environment. Connect a domain you own instead."
      : !configured
        ? "Managed registration is not configured yet. Connect a domain you own instead."
        : null,
  };
}

export function formatRegistrarPrice(cents?: number | null) {
  if (!cents || cents <= 0) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export async function checkManagedDomainAvailability(domainName: string) {
  const readiness = getManagedPurchasingReadiness();
  if (!readiness.ready) throw new Error(readiness.reason || "Managed registration is not available.");
  const domain = domainName.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  const provider = getDomainProvider();
  const [search, quote] = await Promise.all([
    provider.searchDomains(domain),
    provider.getDomainQuote(domain),
  ]);
  if (!search.ok && !quote.ok) {
    throw new Error(search.safeError || quote.safeError || "Could not check that domain. Try again.");
  }
  const available = search.data?.[0]?.available !== false && quote.data?.available !== false;
  return {
    domainName: quote.data?.domainName || search.data?.[0]?.domainName || domain,
    available,
    estimatedCostCents: quote.data?.estimatedCostCents ?? search.data?.[0]?.estimatedCostCents ?? null,
    resalePriceCents: quote.data?.resalePriceCents ?? null,
    providerQuoteId: quote.data?.providerQuoteId ?? search.data?.[0]?.providerQuoteId ?? null,
    message: available
      ? null
      : "That domain is not available to register. Try another name or connect a domain you already own.",
  };
}

export async function purchaseManagedDomainForWorkspace(input: {
  workspaceId: string;
  actorUserId: string;
  domainName: string;
  registrantAttestationAccepted: boolean;
}) {
  const readiness = getManagedPurchasingReadiness();
  if (!readiness.enabled) {
    throw new Error("Managed registration is not available in this environment. Connect a domain you own instead.");
  }
  if (!readiness.configured) {
    throw new Error("Managed registration is not configured yet. Connect a domain you own instead.");
  }

  const { addByoDomain } = await import("@/lib/sending-infrastructure/byo-domain");
  const { enforceAllowance } = await import("@/lib/sending-infrastructure/readiness");
  const { getWorkspaceEffectiveEntitlements } = await import("@/lib/sending-infrastructure/operational");

  const domainName = input.domainName.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  const { effective } = await getWorkspaceEffectiveEntitlements(input.workspaceId);
  const used = await prisma.managedDomain.count({ where: { workspaceId: input.workspaceId } });
  const allowance = enforceAllowance("domain", effective, used);
  if (!allowance.allowed) {
    throw new Error(
      allowance.reason ||
        "Your plan is at its domain limit. Upgrade or remove a domain to register another.",
    );
  }

  const existingDomain = await prisma.managedDomain.findUnique({ where: { domainName } });
  if (existingDomain?.workspaceId && existingDomain.workspaceId !== input.workspaceId) {
    throw new Error("That domain is already attached to another workspace.");
  }

  let request = await prisma.domainPurchaseRequest.findFirst({
    where: { workspaceId: input.workspaceId, requestedDomain: domainName },
    include: { registrantSnapshot: true },
    orderBy: { createdAt: "desc" },
  });

  if (request?.status === "PURCHASED") {
    if (!existingDomain || existingDomain.workspaceId !== input.workspaceId) {
      await addByoDomain({
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        domainName,
        source: "purchased",
      });
    }
    return { alreadyPurchased: true as const, domainName, requestId: request.id };
  }

  if (!request || ["FAILED", "CANCELED", "REJECTED", "DRAFT"].includes(request.status)) {
    const created = await createDomainPurchaseRequest({
      requestedDomain: domainName,
      workspaceId: input.workspaceId,
      requestedByUserId: input.actorUserId,
      ownershipType: "WORKSPACE_OWNED",
      registrantAttestationAccepted: input.registrantAttestationAccepted,
    });
    request = await prisma.domainPurchaseRequest.findUniqueOrThrow({
      where: { id: created.id },
      include: { registrantSnapshot: true },
    });
  }

  if (request.status === "QUOTED" || request.status === "SUBMITTED") {
    request = await prisma.domainPurchaseRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", approvedByUserId: input.actorUserId },
      include: { registrantSnapshot: true },
    });
  }

  const check = await checkManagedDomainAvailability(domainName);
  if (!check.available) throw new Error(check.message || "That domain is not available.");

  await prisma.domainPurchaseRequest.update({
    where: { id: request.id },
    data: { status: "PURCHASING", estimatedCostCents: check.estimatedCostCents, providerQuoteId: check.providerQuoteId },
  });

  const result = await getDomainProvider().purchaseDomain(domainName, request.id, request);
  if (!result.ok) {
    await prisma.domainPurchaseRequest.update({
      where: { id: request.id },
      data: { status: "FAILED", safeError: result.safeError },
    });
    throw new Error(result.safeError || "The registrar could not complete that purchase.");
  }

  await prisma.domainPurchaseRequest.update({
    where: { id: request.id },
    data: { status: "PURCHASED", purchasedAt: new Date(), safeError: null },
  });

  const attached = await addByoDomain({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    domainName,
    source: "purchased",
  });
  await prisma.managedDomain.update({
    where: { id: attached.id },
    data: {
      provider: getDomainProvider().name,
      providerDomainId: result.data?.providerDomainId,
      purchaseCostCents: check.estimatedCostCents,
      registrarStatus: "REGISTERED",
      lifecycleStatus: "DNS_PENDING",
    },
  });
  if (process.env.DNS_AUTOMATION_ENABLED === "true") {
    const { enqueueDurableJob } = await import("@/lib/jobs/service");
    await enqueueDurableJob({
      workspaceId: input.workspaceId,
      jobType: "DOMAIN_DNS_CONFIGURATION",
      idempotencyKey: `dns:${attached.id}`,
      payload: { domainId: attached.id },
    });
  }
  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      actorId: input.actorUserId,
      action: "MANAGED_DOMAIN_PURCHASED",
      entityType: "ManagedDomain",
      entityId: attached.id,
      metadata: { domainName, requestId: request.id, providerDomainId: result.data?.providerDomainId },
    },
  });
  return { alreadyPurchased: false as const, domainName, requestId: request.id, domainId: attached.id };
}

export async function retryDomainPurchaseRequest(id: string, actorUserId: string) {
  const request = await prisma.domainPurchaseRequest.findUnique({
    where: { id },
    include: { registrantSnapshot: true },
  });
  if (!request) throw new Error("Purchase request not found.");
  if (!request.workspaceId) throw new Error("Purchase request has no workspace.");
  return purchaseManagedDomainForWorkspace({
    workspaceId: request.workspaceId,
    actorUserId,
    domainName: request.requestedDomain,
    registrantAttestationAccepted: Boolean(request.registrantAttestationAccepted),
  });
}

export async function markDomainPurchaseFailed(id: string, actorUserId: string, note: string) {
  if (note.trim().length < 8) throw new Error("An audit note is required.");
  const request = await prisma.domainPurchaseRequest.update({
    where: { id },
    data: { status: "FAILED", safeError: note.trim() },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: request.workspaceId,
      actorId: actorUserId,
      action: "MANAGED_DOMAIN_PURCHASE_MARKED_FAILED",
      entityType: "DomainPurchaseRequest",
      entityId: request.id,
      metadata: { note: note.trim(), domainName: request.requestedDomain },
    },
  });
  return request;
}

export async function purchaseApprovedDomain(id: string) {
  const request = await (prisma as any).domainPurchaseRequest.findUnique({
    where: { id },
    include: { registrantSnapshot: true },
  });
  if (!request || request.status !== "APPROVED")
    throw new Error("Purchase request must be approved before purchasing.");
  if (
    request.ownershipType === "WORKSPACE_OWNED" &&
    !request.registrantSnapshot
  )
    throw new Error(
      "Workspace-owned purchase requires an immutable registrant snapshot.",
    );
  const result = await getDomainProvider().purchaseDomain(
    request.requestedDomain,
    id,
    request as any,
  );
  if (!result.ok)
    return (prisma as any).domainPurchaseRequest.update({
      where: { id },
      data: { status: "FAILED", safeError: result.safeError },
    });
  return (prisma as any).domainPurchaseRequest.update({
    where: { id },
    data: { status: "PURCHASED", purchasedAt: new Date() },
  });
}
