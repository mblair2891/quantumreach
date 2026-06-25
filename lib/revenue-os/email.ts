/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { isDomainSendReady } from "@/lib/managed-domains/service";

type SendInput = { workspaceId: string; to: string; subject: string; html: string; campaignId?: string; sequenceStepId?: string; contactId?: string; senderIdentityId?: string; managedDomainId?: string };

export type EmailProviderResult = { sent: boolean; providerMessageId?: string; reason?: string };
export interface EmailProvider { name: string; isReady(): boolean; send(input: SendInput): Promise<EmailProviderResult>; }

export function getEmailConfig() {
  const enabled = process.env.EMAIL_SENDING_ENABLED === "true";
  const sandbox = process.env.EMAIL_SANDBOX_MODE !== "false";
  const awsReady = Boolean(process.env.AWS_SES_REGION && process.env.AWS_SES_ACCESS_KEY_ID && process.env.AWS_SES_SECRET_ACCESS_KEY);
  return { enabled, sandbox, awsReady, provider: enabled && !sandbox && awsReady ? "aws-ses" : "disabled" };
}

class DisabledEmailProvider implements EmailProvider {
  name = "disabled";
  isReady() { return false; }
  async send(): Promise<EmailProviderResult> { return { sent: false, reason: "Email sending is disabled or sandboxed. No live email was sent." }; }
}

class AwsSesProvider implements EmailProvider {
  name = "aws-ses";
  isReady() { return getEmailConfig().provider === "aws-ses"; }
  async send(): Promise<EmailProviderResult> {
    if (!this.isReady()) return { sent: false, reason: "AWS SES is not configured." };
    return { sent: false, reason: "AWS SES transport is configured but production worker integration is intentionally deferred." };
  }
}

export function getEmailProvider(): EmailProvider { return getEmailConfig().provider === "aws-ses" ? new AwsSesProvider() : new DisabledEmailProvider(); }
export function createToken(bytes = 32) { return crypto.randomBytes(bytes).toString("base64url"); }
export function hashSnapshot(value: string) { return crypto.createHash("sha256").update(value).digest("hex"); }
export function normalizeEmail(email: string) { return email.trim().toLowerCase(); }

export async function isSuppressed(workspaceId: string, email: string) {
  const count = await (prisma as any).suppressionListEntry.count({ where: { workspaceId, email: normalizeEmail(email) } });
  return count > 0;
}

export async function addSuppression(workspaceId: string, email: string, reason: "UNSUBSCRIBED" | "HARD_BOUNCE" | "COMPLAINT" | "MANUAL" | "IMPORTED", source?: string, contactId?: string) {
  return (prisma as any).suppressionListEntry.upsert({
    where: { workspaceId_email_reason: { workspaceId, email: normalizeEmail(email), reason } },
    update: { source, contactId },
    create: { workspaceId, email: normalizeEmail(email), reason, source, contactId }
  });
}

export async function enforceSendGate(input: SendInput) {
  if (await isSuppressed(input.workspaceId, input.to)) return { allowed: false, status: "BLOCKED_SUPPRESSED", reason: "Recipient is suppressed, unsubscribed, bounced, or complained." } as const;
  const cfg = getEmailConfig();
  if (!cfg.enabled || cfg.sandbox || !cfg.awsReady) return { allowed: false, status: "BLOCKED_COMPLIANCE", reason: "Live email is disabled until AWS SES and sending readiness are configured." } as const;
  if (input.senderIdentityId) {
    const sender = await (prisma as any).senderIdentity.findFirst({ where: { id: input.senderIdentityId, workspaceId: input.workspaceId } });
    if (!sender || sender.status !== "ACTIVE") return { allowed: false, status: "BLOCKED_COMPLIANCE", reason: "Sender identity is not active for this workspace." } as const;
  }
  if (input.managedDomainId) {
    const domain = await (prisma as any).managedDomain.findFirst({ where: { id: input.managedDomainId, workspaceId: input.workspaceId }, include: { warmupPlan: true } });
    if (!domain) return { allowed: false, status: "BLOCKED_COMPLIANCE", reason: "Managed domain is not assigned to this workspace." } as const;
    const readiness = await isDomainSendReady(input.managedDomainId);
    if (!readiness.ready) return { allowed: false, status: "BLOCKED_COMPLIANCE", reason: readiness.reason } as const;
    const domainSentToday = await (prisma as any).emailSend.count({ where: { workspaceId: input.workspaceId, status: "SENT", createdAt: { gte: (() => { const d = new Date(); d.setUTCHours(0,0,0,0); return d; })() } } });
    if (domainSentToday >= (readiness.currentDailyLimit || 0)) return { allowed: false, status: "BLOCKED_LIMIT", reason: "Managed domain warmup daily limit reached." } as const;
  }
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const sentToday = await (prisma as any).emailSend.count({ where: { workspaceId: input.workspaceId, status: "SENT", createdAt: { gte: dayStart } } });
  const limit = Number(process.env.OUTBOUND_WORKSPACE_DAILY_SEND_LIMIT || 250);
  if (sentToday >= limit) return { allowed: false, status: "BLOCKED_LIMIT", reason: "Workspace daily sending limit reached." } as const;
  return { allowed: true } as const;
}

export async function queueOrSendEmail(input: SendInput) {
  const gate = await enforceSendGate(input);
  const status = gate.allowed ? "QUEUED" : gate.status;
  const send = await (prisma as any).emailSend.create({ data: { workspaceId: input.workspaceId, campaignId: input.campaignId, sequenceStepId: input.sequenceStepId, contactId: input.contactId, senderIdentityId: input.senderIdentityId, email: normalizeEmail(input.to), subject: input.subject, bodyHash: hashSnapshot(input.html), status, blockReason: gate.allowed ? null : gate.reason } });
  if (!gate.allowed) return send;
  const provider = getEmailProvider();
  const result = await provider.send(input);
  return (prisma as any).emailSend.update({ where: { id: send.id }, data: { status: result.sent ? "SENT" : "FAILED", providerMessageId: result.providerMessageId, blockReason: result.reason, sentAt: result.sent ? new Date() : null } });
}

export async function unsubscribeByToken(token: string) {
  const recipient = await (prisma as any).emailRecipient.findUnique({ where: { unsubscribeToken: token }, include: { campaign: true } });
  if (!recipient) return null;
  await addSuppression(recipient.workspaceId, recipient.email, "UNSUBSCRIBED", "unsubscribe_link", recipient.contactId ?? undefined);
  await (prisma as any).emailEvent.create({ data: { workspaceId: recipient.workspaceId, eventType: "unsubscribe", safeSummary: { emailDomain: recipient.email.split("@")[1] ?? null } } });
  return { ok: true, workspaceId: recipient.workspaceId };
}

export async function handleSesEvent(input: { workspaceId: string; type: "bounce" | "complaint"; email: string; messageId?: string }) {
  const reason = input.type === "bounce" ? "HARD_BOUNCE" : "COMPLAINT";
  await addSuppression(input.workspaceId, input.email, reason, `aws_ses_${input.type}`);
  return (prisma as any).emailEvent.create({ data: { workspaceId: input.workspaceId, eventType: input.type, safeSummary: { messageId: input.messageId, emailDomain: input.email.split("@")[1] ?? null } } });
}
