import crypto from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { getSendingGates } from "@/lib/sending-infrastructure/gates";
import { hygieneSkipReason, isCampaignEligible, normalizeEmail, requiredFieldsFromTemplate } from "@/lib/contacts/hygiene";
import {
  appendCommercialFooter,
  applyOutreachMergeTags,
  assertInstantlyCompliance,
  buildUnsubscribeUrl,
  workspaceSendingIdentity,
} from "./compliance";
import { canSend, recordSend } from "./service";
import { getOutboundProviderForInbox, type OutboundProvider } from "./providers";
import { utcDay } from "./config";

type Db = typeof prisma;

export type InboxPool = { type: "all" } | { type: "explicit"; inboxIds: string[] };

function parseInboxPool(value: unknown): InboxPool {
  if (value && typeof value === "object" && !Array.isArray(value) && (value as { type?: string }).type === "explicit") {
    const inboxIds = Array.isArray((value as { inboxIds?: unknown }).inboxIds)
      ? ((value as { inboxIds: unknown[] }).inboxIds.filter((id): id is string => typeof id === "string"))
      : [];
    return { type: "explicit", inboxIds };
  }
  return { type: "all" };
}

export function applyMergeTags(
  template: string,
  contact: { firstName?: string | null; lastName?: string | null; email?: string | null },
  extras: { unsubscribeUrl?: string } = {},
) {
  return applyOutreachMergeTags(template, contact, extras);
}

function newUnsubscribeToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function assertManagedSendingEnabled() {
  if (!getSendingGates().managedSendingEnabled) {
    throw new Error("Cold outreach campaigns are disabled until MANAGED_SENDING_ENABLED=true.");
  }
}

export async function createOutreachCampaign(
  input: {
    workspaceId: string;
    listId: string;
    name: string;
    subject: string;
    body: string;
    fromName?: string | null;
    inboxIds?: string[];
    startAt?: Date | null;
  },
  db: Db = prisma,
) {
  const name = input.name.trim();
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!name) throw new Error("Campaign name is required.");
  if (!subject) throw new Error("Subject is required.");
  if (!body) throw new Error("Body is required.");
  const list = await db.outboundList.findFirst({ where: { id: input.listId, workspaceId: input.workspaceId } });
  if (!list) throw new Error("Contact list was not found.");
  const inboxPool: InboxPool = input.inboxIds?.length ? { type: "explicit", inboxIds: input.inboxIds } : { type: "all" };
  return db.outboundCampaign.create({
    data: {
      workspaceId: input.workspaceId,
      listId: list.id,
      name,
      subject,
      body,
      fromName: input.fromName?.trim() || null,
      inboxPool: inboxPool as object,
      startAt: input.startAt ?? null,
      status: "draft",
    },
  });
}

export async function startOutreachCampaign(campaignId: string, workspaceId: string, db: Db = prisma) {
  assertManagedSendingEnabled();
  const campaign = await db.outboundCampaign.findFirst({
    where: { id: campaignId, workspaceId },
    include: { list: { include: { members: { include: { contact: { include: { company: true } } } } } } },
  });
  if (!campaign) throw new Error("Campaign was not found.");
  if (!["draft", "paused"].includes(campaign.status)) throw new Error("This campaign cannot be started.");

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  const identity = workspaceSendingIdentity(workspace);
  assertInstantlyCompliance({ subject: campaign.subject, body: campaign.body, identity });

  const requiredFields = requiredFieldsFromTemplate(campaign.subject, campaign.body);
  const members = campaign.list.members;
  const primaryByEmail = new Map<string, (typeof members)[number]>();
  for (const member of members) {
    const email = normalizeEmail(member.contact.email ?? "");
    if (!email) continue;
    const current = primaryByEmail.get(email);
    if (!current) {
      primaryByEmail.set(email, member);
      continue;
    }
    if (isCampaignEligible(member.contact, requiredFields) && !isCampaignEligible(current.contact, requiredFields)) {
      primaryByEmail.set(email, member);
    }
  }
  const readyPrimaries: typeof members = [];
  for (const member of primaryByEmail.values()) {
    if (!isCampaignEligible(member.contact, requiredFields)) continue;
    const email = normalizeEmail(member.contact.email ?? "");
    const suppressed = await db.suppressionListEntry.findFirst({ where: { workspaceId, email } });
    if (suppressed) continue;
    readyPrimaries.push(member);
  }
  if (!readyPrimaries.length) {
    throw new Error("This campaign has no campaign-ready contacts. Review the list and import ready rows only.");
  }

  for (const member of members) {
    const email = normalizeEmail(member.contact.email ?? "");
    const suppressed = email ? await db.suppressionListEntry.findFirst({ where: { workspaceId, email } }) : null;
    const primary = email ? primaryByEmail.get(email) : undefined;
    const isPrimary = primary?.contactId === member.contactId;
    let status = "queued";
    let skipReason: string | null = null;
    if (suppressed) {
      status = "skipped";
      skipReason = "SUPPRESSED";
    } else if (email && primary && !isPrimary) {
      status = "skipped";
      skipReason = "DUPLICATE_EMAIL";
    } else if (!isCampaignEligible(member.contact, requiredFields)) {
      status = "skipped";
      skipReason = hygieneSkipReason(member.contact) ?? "NOT_READY";
    }
    await db.outboundCampaignJob.upsert({
      where: { campaignId_contactId: { campaignId: campaign.id, contactId: member.contactId } },
      create: {
        workspaceId,
        campaignId: campaign.id,
        contactId: member.contactId,
        email,
        status,
        skipReason,
        unsubscribeToken: newUnsubscribeToken(),
      },
      update: {},
    });
  }

  return db.outboundCampaign.update({
    where: { id: campaign.id },
    data: { status: "running", pauseReason: null, startAt: campaign.startAt ?? new Date() },
  });
}

export async function pauseOutreachCampaign(campaignId: string, workspaceId: string, reason?: string, db: Db = prisma) {
  const campaign = await db.outboundCampaign.findFirst({ where: { id: campaignId, workspaceId } });
  if (!campaign) throw new Error("Campaign was not found.");
  if (campaign.status !== "running") throw new Error("Only a running campaign can be paused.");
  return db.outboundCampaign.update({
    where: { id: campaign.id },
    data: { status: "paused", pauseReason: reason ?? "PAUSED" },
  });
}

async function pickEligibleInbox(
  workspaceId: string,
  pool: InboxPool,
  db: Db,
  now: Date,
) {
  const where =
    pool.type === "explicit"
      ? { workspaceId, id: { in: pool.inboxIds }, status: "ACTIVE", health: "HEALTHY" }
      : { workspaceId, status: "ACTIVE", health: "HEALTHY" };
  const inboxes = await db.inbox.findMany({
    where,
    orderBy: [{ lastSentAt: "asc" }, { createdAt: "asc" }],
  });
  for (const inbox of inboxes) {
    const check = await canSend(inbox.id, db, now);
    if (check.allowed) return inbox;
  }
  return null;
}

export async function processCampaignBatch(
  campaignId: string,
  options: { db?: Db; provider?: OutboundProvider; now?: Date; limit?: number } = {},
) {
  const db = options.db ?? prisma;
  const now = options.now ?? new Date();
  const limit = options.limit ?? 25;
  if (!getSendingGates().managedSendingEnabled) {
    throw new Error("Cold outreach campaigns are disabled until MANAGED_SENDING_ENABLED=true.");
  }

  const campaign = await db.outboundCampaign.findUnique({
    where: { id: campaignId },
    include: { workspace: true },
  });
  if (!campaign || campaign.status !== "running") return { processed: 0, sent: 0, skipped: 0, paused: false };
  const identity = workspaceSendingIdentity(campaign.workspace);

  const jobs = await db.outboundCampaignJob.findMany({
    where: {
      campaignId,
      status: { in: ["queued", "retry"] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  if (!jobs.length) {
    const remaining = await db.outboundCampaignJob.count({ where: { campaignId, status: { in: ["queued", "retry"] } } });
    if (!remaining) {
      await db.outboundCampaign.update({ where: { id: campaignId }, data: { status: "completed", pauseReason: null } });
    }
    return { processed: 0, sent: 0, skipped: 0, paused: false, completed: !remaining };
  }

  const pool = parseInboxPool(campaign.inboxPool);
  let sent = 0;
  let skipped = 0;
  let lastProvider = options.provider?.id ?? "stub";

  for (const job of jobs) {
    const suppressed = await db.suppressionListEntry.findFirst({ where: { workspaceId: campaign.workspaceId, email: job.email } });
    if (suppressed) {
      await db.outboundCampaignJob.update({
        where: { id: job.id },
        data: { status: "skipped", skipReason: "SUPPRESSED", attempts: { increment: 1 } },
      });
      skipped += 1;
      continue;
    }

    const inbox = await pickEligibleInbox(campaign.workspaceId, pool, db, now);
    if (!inbox) {
      await db.outboundCampaign.update({
        where: { id: campaign.id },
        data: { status: "paused", pauseReason: "NO_INBOX_CAPACITY" },
      });
      return { processed: sent + skipped, sent, skipped, paused: true };
    }

    const contact = await db.contact.findUnique({ where: { id: job.contactId } });
    if (contact && !isCampaignEligible(contact)) {
      await db.outboundCampaignJob.update({
        where: { id: job.id },
        data: { status: "skipped", skipReason: hygieneSkipReason(contact) ?? "NOT_READY", attempts: { increment: 1 } },
      });
      skipped += 1;
      continue;
    }
    let unsubscribeToken = job.unsubscribeToken;
    if (!unsubscribeToken) {
      unsubscribeToken = newUnsubscribeToken();
      await db.outboundCampaignJob.update({ where: { id: job.id }, data: { unsubscribeToken } });
    }
    const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeToken);
    const mergeContact = contact ?? { email: job.email };
    const subject = applyMergeTags(campaign.subject, mergeContact, { unsubscribeUrl });
    const body = appendCommercialFooter(
      applyMergeTags(campaign.body, mergeContact, { unsubscribeUrl }),
      identity,
      unsubscribeUrl,
    );
    const provider =
      options.provider ??
      getOutboundProviderForInbox(inbox, {
        MANAGED_SENDING_ENABLED: getSendingGates().managedSendingEnabled ? "true" : "false",
      });
    lastProvider = provider.id;
    const delivered = await provider.send({
      fromInbox: { id: inbox.id, emailAddress: inbox.emailAddress, displayName: inbox.displayName },
      fromName: campaign.fromName,
      to: job.email,
      subject,
      body,
    });

    if (!delivered.ok) {
      if (delivered.reason === "AUTH_REVOKED") {
        await db.inbox.update({
          where: { id: inbox.id },
          data: {
            health: "UNHEALTHY",
            googleConnectionStatus: "REVOKED",
            lastError: "Google access was revoked. Reconnect this inbox.",
          },
        });
      }
      if (delivered.reason === "BOUNCE_LIKE") {
        await db.suppressionListEntry.create({
          data: {
            workspaceId: campaign.workspaceId,
            email: job.email,
            reason: "HARD_BOUNCE",
            source: "google_outbound",
          },
        }).catch(() => undefined);
        await db.outboundCampaignJob.update({
          where: { id: job.id },
          data: {
            status: "skipped",
            skipReason: "BOUNCE_LIKE",
            attempts: { increment: 1 },
            inboxId: inbox.id,
          },
        });
        skipped += 1;
        continue;
      }
      await db.outboundCampaignJob.update({
        where: { id: job.id },
        data: {
          status: "retry",
          skipReason: delivered.reason,
          attempts: { increment: 1 },
          nextAttemptAt: new Date(now.getTime() + 15 * 60 * 1000),
          inboxId: inbox.id,
        },
      });
      continue;
    }

    const log = await recordSend(
      {
        inboxId: inbox.id,
        toEmail: job.email,
        contactId: job.contactId,
        campaignId: campaign.id,
        campaignJobId: job.id,
        status: delivered.provider === "google" ? "SENT" : "STUB_SENT",
      },
      db,
      now,
    );
    if (log.status !== "STUB_SENT" && log.status !== "SENT") {
      await db.outboundCampaignJob.update({
        where: { id: job.id },
        data: {
          status: log.blockReason === "SUPPRESSED" ? "skipped" : "retry",
          skipReason: log.blockReason,
          attempts: { increment: 1 },
          sendLogId: log.id,
          inboxId: inbox.id,
          nextAttemptAt: log.blockReason === "SUPPRESSED" ? null : new Date(now.getTime() + 15 * 60 * 1000),
        },
      });
      skipped += 1;
      continue;
    }

    await db.outboundCampaignJob.update({
      where: { id: job.id },
      data: { status: "sent", inboxId: inbox.id, sendLogId: log.id, attempts: { increment: 1 }, skipReason: null },
    });
    sent += 1;
  }

  const remaining = await db.outboundCampaignJob.count({ where: { campaignId, status: { in: ["queued", "retry"] } } });
  if (!remaining) {
    await db.outboundCampaign.update({ where: { id: campaignId }, data: { status: "completed", pauseReason: null } });
  }
  return { processed: sent + skipped, sent, skipped, paused: false, completed: !remaining, utcDay: utcDay(now), provider: lastProvider };
}

export async function campaignCapacity(workspaceId: string, db: Db = prisma, now = new Date()) {
  const day = utcDay(now);
  const inboxes = await db.inbox.findMany({
    where: { workspaceId },
    include: { domain: true },
    orderBy: { createdAt: "asc" },
  });
  const rows = [];
  for (const inbox of inboxes) {
    const check = await canSend(inbox.id, db, now);
    const used = await db.sendLog.count({
      where: { inboxId: inbox.id, utcDay: day, status: { in: ["STUB_SENT", "SENT"] } },
    });
    rows.push({
      inboxId: inbox.id,
      emailAddress: inbox.emailAddress,
      domain: inbox.domain.domain,
      status: inbox.status,
      health: inbox.health,
      provider: inbox.provider,
      googleConnectionStatus: inbox.googleConnectionStatus,
      lastError: inbox.lastError,
      lastSuccessfulSendAt: inbox.lastSuccessfulSendAt,
      usedToday: used,
      remaining: check.inboxRemaining,
      domainRemaining: check.domainRemaining,
      allowed: check.allowed,
      reason: check.reason,
    });
  }
  return rows;
}

/** Hourly worker drain. Skips paused campaigns. Idempotent: only queued/retry jobs send. */
export async function processRunningOutboundCampaigns(
  options: { db?: Db; provider?: OutboundProvider; now?: Date; limit?: number; campaignLimit?: number } = {},
) {
  const db = options.db ?? prisma;
  if (!getSendingGates().managedSendingEnabled) {
    return { processedCampaigns: 0, sent: 0, skipped: 0, skippedReason: "MANAGED_SENDING_DISABLED" as const };
  }
  const running = await db.outboundCampaign.findMany({
    where: { status: "running" },
    orderBy: { updatedAt: "asc" },
    take: options.campaignLimit ?? 20,
    select: { id: true },
  });
  let sent = 0;
  let skipped = 0;
  let paused = 0;
  for (const campaign of running) {
    const result = await processCampaignBatch(campaign.id, options);
    sent += result.sent ?? 0;
    skipped += result.skipped ?? 0;
    if (result.paused) paused += 1;
  }
  return { processedCampaigns: running.length, sent, skipped, paused };
}
