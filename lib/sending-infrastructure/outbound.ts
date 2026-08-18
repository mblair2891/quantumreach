import "server-only";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { prisma } from "@/lib/db/prisma";
import { evaluateSenderReadiness } from "./readiness";
import { getSendingGates, isSesIdentityVerified, sesCredentials, unavailableMessage } from "./gates";
import { warmupDailyLimit } from "./warmup";

export type WorkspaceTestSendResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: string };

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function sendWorkspaceTestEmail(input: {
  workspaceId: string;
  actorUserId: string;
  senderId: string;
  to: string;
  subject?: string;
  text?: string;
}): Promise<WorkspaceTestSendResult> {
  const gates = getSendingGates();
  if (!gates.emailSendingEnabled || !gates.managedSendingEnabled) {
    return { sent: false, reason: unavailableMessage("Managed outbound sending") };
  }
  if (!gates.sesConfigured) return { sent: false, reason: "AWS_SES_NOT_CONFIGURED" };

  const to = normalizeEmail(input.to);
  if (!to.includes("@")) return { sent: false, reason: "RECIPIENT_INVALID" };

  const sender = await prisma.infrastructureSenderIdentity.findFirst({
    where: { id: input.senderId, workspaceId: input.workspaceId },
  });
  if (!sender) return { sent: false, reason: "SENDER_NOT_FOUND" };

  const [mailbox, domain, suppressed] = await Promise.all([
    sender.managedMailboxId
      ? prisma.managedMailbox.findFirst({ where: { id: sender.managedMailboxId, workspaceId: input.workspaceId } })
      : null,
    prisma.managedDomain.findFirst({
      where: { id: sender.managedDomainId, OR: [{ workspaceId: input.workspaceId }, { assignments: { some: { workspaceId: input.workspaceId, status: "ACTIVE" } } }] },
      include: { sesIdentity: true, warmupPlan: true },
    }),
    prisma.suppressionListEntry.findFirst({ where: { workspaceId: input.workspaceId, email: to } }),
  ]);
  if (suppressed) return { sent: false, reason: "RECIPIENT_SUPPRESSED" };
  if (!domain) return { sent: false, reason: "DOMAIN_NOT_FOUND" };

  const profile = mailbox
    ? await prisma.mailboxWarmupProfile.findUnique({ where: { managedMailboxId: mailbox.id } })
    : null;
  const day = profile?.currentStage ?? domain.warmupPlan?.currentDay ?? 1;
  const dailyCap = profile?.currentDailyLimit || domain.warmupPlan?.currentDailyLimit || warmupDailyLimit(Math.max(1, day));
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const sentToday = await prisma.outboundMessageLedger.count({
    where: { workspaceId: input.workspaceId, sentAt: { gte: dayStart }, status: "SENT" },
  });
  if (sentToday >= dailyCap) return { sent: false, reason: "WARMUP_DAILY_CAP" };

  const mailboxActive = mailbox?.status === "ACTIVE" || mailbox?.outboundEnabled === true || mailbox?.status === "PENDING_PROVIDER_CONFIGURATION";
  const readiness = evaluateSenderReadiness({
    domainReady: isSesIdentityVerified(domain.sesIdentity?.verificationStatus),
    mailboxActive: Boolean(mailboxActive),
    sesIdentityReady: isSesIdentityVerified(domain.sesIdentity?.verificationStatus) || isSesIdentityVerified(sender.sesIdentityState),
    dkimReady: isSesIdentityVerified(domain.sesIdentity?.dkimStatus) || isSesIdentityVerified(sender.dkimState),
    complianceReady: true,
    rampReady: Boolean(profile && profile.currentDailyLimit > 0 && profile.lifecycleState !== "PAUSED"),
    sendingEnabled: gates.managedSendingEnabled,
    dailySendCap: dailyCap,
  });
  if (!readiness.ready) return { sent: false, reason: readiness.blockingReasons[0] ?? "SENDER_NOT_READY" };

  const subject = input.subject?.trim() || "Quantum Reach test send";
  const text = input.text?.trim() || "This is a bounded test send from your Quantum Reach workspace sender.";
  const { region, credentials } = sesCredentials();
  const client = new SESClient({ region, credentials });
  try {
    const response = await client.send(
      new SendEmailCommand({
        Source: sender.fromAddress,
        Destination: { ToAddresses: [to] },
        ConfigurationSetName: gates.configurationSet || undefined,
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: { Text: { Data: text, Charset: "UTF-8" } },
        },
      }),
    );
    const messageId = response.MessageId?.trim();
    if (!messageId) return { sent: false, reason: "SES_MESSAGE_ID_MISSING" };
    await prisma.outboundMessageLedger.create({
      data: {
        workspaceId: input.workspaceId,
        senderIdentityId: sender.id,
        managedMailboxId: mailbox?.id ?? sender.managedMailboxId,
        managedDomainId: domain.id,
        provider: "aws_ses",
        providerMessageId: messageId,
        messageId,
        status: "SENT",
        sentAt: new Date(),
      },
    }).catch(() => undefined);
    await prisma.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        actorId: input.actorUserId,
        action: "WORKSPACE_TEST_SEND",
        entityType: "InfrastructureSenderIdentity",
        entityId: sender.id,
        metadata: { messageId, domainId: domain.id, mailboxId: mailbox?.id ?? null },
      },
    });
    console.info(JSON.stringify({ event: "workspace_test_send", workspaceId: input.workspaceId, domainId: domain.id, mailboxId: mailbox?.id ?? null, messageId }));
    return { sent: true, messageId };
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 300) : "SES_SEND_FAILED";
    console.warn(JSON.stringify({ event: "workspace_test_send_failed", workspaceId: input.workspaceId, reason }));
    return { sent: false, reason };
  }
}
