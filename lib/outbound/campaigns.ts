import { prisma } from "@/lib/db/prisma";
import { getSendingGates } from "@/lib/sending-infrastructure/gates";
import { canSend, recordSend } from "./service";
import { getOutboundProvider, type OutboundProvider } from "./providers";
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

export function applyMergeTags(template: string, contact: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return template
    .replaceAll(/\{\{\s*FirstName\s*\}\}/gi, contact.firstName?.trim() || "")
    .replaceAll(/\{\{\s*LastName\s*\}\}/gi, contact.lastName?.trim() || "")
    .replaceAll(/\{\{\s*Email\s*\}\}/gi, contact.email?.trim() || "");
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
    include: { list: { include: { members: { include: { contact: true } } } } },
  });
  if (!campaign) throw new Error("Campaign was not found.");
  if (!["draft", "paused"].includes(campaign.status)) throw new Error("This campaign cannot be started.");

  const members = campaign.list.members.filter((member) => member.contact.email?.includes("@"));
  for (const member of members) {
    const email = member.contact.email!.trim().toLowerCase();
    const suppressed = await db.suppressionListEntry.findFirst({ where: { workspaceId, email } });
    await db.outboundCampaignJob.upsert({
      where: { campaignId_contactId: { campaignId: campaign.id, contactId: member.contactId } },
      create: {
        workspaceId,
        campaignId: campaign.id,
        contactId: member.contactId,
        email,
        status: suppressed ? "skipped" : "queued",
        skipReason: suppressed ? "SUPPRESSED" : null,
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

  const campaign = await db.outboundCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== "running") return { processed: 0, sent: 0, skipped: 0, paused: false };

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

  const provider = options.provider ?? getOutboundProvider();
  const pool = parseInboxPool(campaign.inboxPool);
  let sent = 0;
  let skipped = 0;

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
    const subject = applyMergeTags(campaign.subject, contact ?? { email: job.email });
    const body = applyMergeTags(campaign.body, contact ?? { email: job.email });
    const delivered = await provider.send({
      fromInbox: { id: inbox.id, emailAddress: inbox.emailAddress, displayName: inbox.displayName },
      fromName: campaign.fromName,
      to: job.email,
      subject,
      body,
    });

    if (!delivered.ok) {
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
      { inboxId: inbox.id, toEmail: job.email, contactId: job.contactId, campaignId: campaign.id, campaignJobId: job.id },
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
  return { processed: sent + skipped, sent, skipped, paused: false, completed: !remaining, utcDay: utcDay(now), provider: provider.id };
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
      usedToday: used,
      remaining: check.inboxRemaining,
      domainRemaining: check.domainRemaining,
      allowed: check.allowed,
      reason: check.reason,
    });
  }
  return rows;
}
