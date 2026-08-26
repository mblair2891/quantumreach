import { prisma } from "@/lib/db/prisma";
import { getWorkspaceEffectiveEntitlements } from "@/lib/sending-infrastructure/operational";
import { getWorkspaceCoreDomain, normalizeCoreDomainName } from "@/lib/workspaces/core-domain";
import { hygienizeRows, parseCsv, summarizeHygiene } from "@/lib/contacts/hygiene";
import { loadHygieneContext, persistReadyRows } from "@/lib/contacts/ingest";
import {
  DEFAULT_INBOX_DAILY_LIMIT,
  INBOXES_PER_DOMAIN,
  domainDailyLimit,
  sendingPackageLimits,
  utcDay,
} from "./config";

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const LOCAL_PART_RE = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/i;

type Db = typeof prisma;

export type CanSendResult = {
  allowed: boolean;
  reason?: string;
  inboxRemaining: number;
  domainRemaining: number;
  workspaceRemaining?: number;
};

function normalizeDomain(value: string) {
  return normalizeCoreDomainName(value);
}

async function packageLimitsFor(workspaceId: string, db: Db) {
  const { effective } = await getWorkspaceEffectiveEntitlements(workspaceId, db);
  return sendingPackageLimits(effective);
}

export async function listSendingDomains(workspaceId: string, db: Db = prisma) {
  return db.sendingDomain.findMany({
    where: { workspaceId },
    include: { inboxes: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function addSendingDomain(input: { workspaceId: string; hostname: string }, db: Db = prisma) {
  const domain = normalizeDomain(input.hostname);
  if (!DOMAIN_RE.test(domain)) throw new Error("Enter a valid sending domain like outreach.example.com.");

  const core = await getWorkspaceCoreDomain(input.workspaceId);
  if (core.mode === "BYO" && core.domainName && core.domainName === domain) {
    throw new Error("That hostname is your main business domain. Use a separate sending domain for outreach.");
  }

  const limits = await packageLimitsFor(input.workspaceId, db);
  const used = await db.sendingDomain.count({ where: { workspaceId: input.workspaceId } });
  if (used >= limits.maxSendingDomains) {
    throw new Error(
      limits.maxSendingDomains
        ? `Your package allows ${limits.maxSendingDomains} sending domain${limits.maxSendingDomains === 1 ? "" : "s"}.`
        : "Your package does not include sending domains.",
    );
  }

  const existing = await db.sendingDomain.findUnique({
    where: { workspaceId_domain: { workspaceId: input.workspaceId, domain } },
  });
  if (existing) throw new Error("That sending domain is already on this workspace.");

  return db.sendingDomain.create({
    data: { workspaceId: input.workspaceId, domain, status: "PENDING" },
  });
}

export async function addInbox(
  input: { workspaceId: string; sendingDomainId: string; localPart: string; displayName?: string | null },
  db: Db = prisma,
) {
  const localPart = input.localPart.trim().toLowerCase();
  if (!LOCAL_PART_RE.test(localPart)) throw new Error("Enter a valid inbox name like hello or outreach.");

  const domain = await db.sendingDomain.findFirst({
    where: { id: input.sendingDomainId, workspaceId: input.workspaceId },
  });
  if (!domain) throw new Error("Sending domain was not found.");

  const core = await getWorkspaceCoreDomain(input.workspaceId);
  if (core.mode === "BYO" && core.domainName && core.domainName === domain.domain) {
    throw new Error("Outreach inboxes cannot be attached to your main business domain.");
  }

  const onDomain = await db.inbox.count({ where: { sendingDomainId: domain.id } });
  if (onDomain >= INBOXES_PER_DOMAIN) {
    throw new Error(`Each sending domain can have at most ${INBOXES_PER_DOMAIN} inboxes.`);
  }

  const limits = await packageLimitsFor(input.workspaceId, db);
  const workspaceInboxes = await db.inbox.count({ where: { workspaceId: input.workspaceId } });
  if (workspaceInboxes >= limits.maxInboxes) {
    throw new Error(
      limits.maxInboxes
        ? `Your package allows ${limits.maxInboxes} inboxes.`
        : "Your package does not include outreach inboxes.",
    );
  }

  const emailAddress = `${localPart}@${domain.domain}`;
  const clash = await db.inbox.findUnique({
    where: { workspaceId_emailAddress: { workspaceId: input.workspaceId, emailAddress } },
  });
  if (clash) throw new Error("That inbox already exists.");

  return db.inbox.create({
    data: {
      workspaceId: input.workspaceId,
      sendingDomainId: domain.id,
      localPart,
      emailAddress,
      displayName: input.displayName?.trim() || null,
      dailyLimit: DEFAULT_INBOX_DAILY_LIMIT,
    },
  });
}

export async function importContactsCsv(
  input: { workspaceId: string; csv: string; createdById?: string | null; listName?: string | null },
  db: Db = prisma,
) {
  const parsed = parseCsv(input.csv);
  if (!parsed.length) throw new Error("CSV is empty.");
  const emails = parsed.map((row) => String(row.email ?? row.Email ?? ""));
  const context = await loadHygieneContext(input.workspaceId, emails, db);
  const rows = hygienizeRows(parsed, { ...context, titleCaseNames: true });
  const summary = summarizeHygiene(rows);
  const persisted = await persistReadyRows(
    {
      workspaceId: input.workspaceId,
      rows,
      source: "IMPORTED_CSV",
      listName: input.listName,
      createdById: input.createdById,
      existingByEmail: context.existingByEmail,
    },
    db,
  );
  const listName = input.listName?.trim();
  let listId: string | null = null;
  if (listName && persisted.contacts.length) {
    const list = await db.outboundList.create({ data: { workspaceId: input.workspaceId, name: listName } });
    listId = list.id;
    for (const contact of persisted.contacts) {
      await db.outboundListMember.create({ data: { listId: list.id, contactId: contact.id } }).catch(() => undefined);
    }
  }
  return {
    created: persisted.created,
    skipped: persisted.skipped,
    merged: persisted.merged,
    total: parsed.length,
    listId,
    ready: summary.readyCount,
    needsReview: summary.needsReviewCount,
    invalid: summary.invalidCount,
    suppressed: summary.suppressedCount,
  };
}

export async function canSend(inboxId: string, db: Db = prisma, now = new Date()): Promise<CanSendResult> {
  const inbox = await db.inbox.findUnique({
    where: { id: inboxId },
    include: { domain: true },
  });
  if (!inbox) return { allowed: false, reason: "INBOX_NOT_FOUND", inboxRemaining: 0, domainRemaining: 0 };
  if (inbox.status !== "ACTIVE" || inbox.health !== "HEALTHY") {
    return { allowed: false, reason: "INBOX_UNHEALTHY", inboxRemaining: 0, domainRemaining: 0 };
  }

  const day = utcDay(now);
  const inboxLimit = inbox.dailyLimit > 0 ? inbox.dailyLimit : DEFAULT_INBOX_DAILY_LIMIT;
  const inboxUsed = await db.sendLog.count({
    where: { inboxId: inbox.id, utcDay: day, status: { in: ["STUB_SENT", "SENT"] } },
  });
  const inboxRemaining = Math.max(0, inboxLimit - inboxUsed);
  if (inboxRemaining <= 0) {
    return { allowed: false, reason: "INBOX_DAILY_LIMIT", inboxRemaining: 0, domainRemaining: 0 };
  }

  const inboxCount = await db.inbox.count({ where: { sendingDomainId: inbox.sendingDomainId } });
  const cap = domainDailyLimit(inboxCount, inbox.domain.dailyCapOverride);
  const domainUsed = await db.sendLog.count({
    where: { sendingDomainId: inbox.sendingDomainId, utcDay: day, status: { in: ["STUB_SENT", "SENT"] } },
  });
  const domainRemaining = Math.max(0, cap - domainUsed);
  if (domainRemaining <= 0) {
    return { allowed: false, reason: "DOMAIN_DAILY_CAP", inboxRemaining, domainRemaining: 0 };
  }

  const limits = await packageLimitsFor(inbox.workspaceId, db);
  if (limits.maxDailySends) {
    const workspaceUsed = await db.sendLog.count({
      where: { workspaceId: inbox.workspaceId, utcDay: day, status: { in: ["STUB_SENT", "SENT"] } },
    });
    const workspaceRemaining = Math.max(0, limits.maxDailySends - workspaceUsed);
    if (workspaceRemaining <= 0) {
      return { allowed: false, reason: "WORKSPACE_DAILY_CAP", inboxRemaining, domainRemaining, workspaceRemaining: 0 };
    }
    return { allowed: true, inboxRemaining, domainRemaining, workspaceRemaining };
  }

  return { allowed: true, inboxRemaining, domainRemaining };
}

export async function recordSend(
  input: {
    inboxId: string;
    toEmail: string;
    contactId?: string | null;
    campaignId?: string | null;
    campaignJobId?: string | null;
    status?: "STUB_SENT" | "SENT";
  },
  db: Db = prisma,
  now = new Date(),
) {
  const toEmail = input.toEmail.trim().toLowerCase();
  if (!toEmail.includes("@")) throw new Error("A recipient email is required.");

  const inbox = await db.inbox.findUnique({
    where: { id: input.inboxId },
    include: { domain: true },
  });
  if (!inbox) throw new Error("Inbox was not found.");

  const suppressed = await db.suppressionListEntry.findFirst({
    where: { workspaceId: inbox.workspaceId, email: toEmail },
  });
  if (suppressed) {
    return db.sendLog.create({
      data: {
        workspaceId: inbox.workspaceId,
        inboxId: inbox.id,
        sendingDomainId: inbox.sendingDomainId,
        contactId: input.contactId ?? null,
        campaignId: input.campaignId ?? null,
        campaignJobId: input.campaignJobId ?? null,
        toEmail,
        status: "BLOCKED",
        blockReason: "SUPPRESSED",
        utcDay: utcDay(now),
      },
    });
  }

  const check = await canSend(inbox.id, db, now);
  if (!check.allowed) {
    return db.sendLog.create({
      data: {
        workspaceId: inbox.workspaceId,
        inboxId: inbox.id,
        sendingDomainId: inbox.sendingDomainId,
        contactId: input.contactId ?? null,
        campaignId: input.campaignId ?? null,
        campaignJobId: input.campaignJobId ?? null,
        toEmail,
        status: "BLOCKED",
        blockReason: check.reason,
        utcDay: utcDay(now),
      },
    });
  }

  const status = input.status === "SENT" ? "SENT" : "STUB_SENT";
  const log = await db.sendLog.create({
    data: {
      workspaceId: inbox.workspaceId,
      inboxId: inbox.id,
      sendingDomainId: inbox.sendingDomainId,
      contactId: input.contactId ?? null,
      campaignId: input.campaignId ?? null,
      campaignJobId: input.campaignJobId ?? null,
      toEmail,
      status,
      utcDay: utcDay(now),
    },
  });
  await db.inbox.update({
    where: { id: inbox.id },
    data: { lastSentAt: now, lastSuccessfulSendAt: now, lastError: null },
  });
  return log;
}

/** Stub cold send. Succeeds only if canSend. Does not call SES or Google. */
export async function stubSend(input: { inboxId: string; toEmail: string; contactId?: string | null }, db: Db = prisma) {
  const log = await recordSend(input, db);
  return {
    ok: log.status === "STUB_SENT",
    status: log.status,
    blockReason: log.blockReason,
    message: log.status === "STUB_SENT" ? "stub sent" : log.blockReason,
    sendLogId: log.id,
  };
}
