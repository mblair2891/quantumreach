import "server-only";
import { prisma } from "@/lib/db/prisma";
import { createMailboxRequest } from "./operational";
import { isSesIdentityVerified } from "./gates";
import { warmupDailyLimit } from "./warmup";

export async function createWorkspaceMailbox(input: {
  workspaceId: string;
  domainId: string;
  localPart: string;
  displayName?: string | null;
}) {
  const domain = await prisma.managedDomain.findFirst({
    where: {
      id: input.domainId,
      OR: [
        { workspaceId: input.workspaceId },
        { assignments: { some: { workspaceId: input.workspaceId, status: "ACTIVE" } } },
      ],
    },
    include: { sesIdentity: true },
  });
  if (!domain) throw new Error("Domain is not assigned to this workspace.");
  const domainVerified = isSesIdentityVerified(domain.sesIdentity?.verificationStatus);
  const dkimVerified = isSesIdentityVerified(domain.sesIdentity?.dkimStatus);
  const sesReady = domainVerified && dkimVerified;
  if (!sesReady) {
    throw new Error("Verify the domain DNS first, then create a mailbox.");
  }
  const mailbox = await createMailboxRequest(input.workspaceId, input.domainId, input.localPart, input.displayName);

  if (sesReady) {
    await prisma.managedMailbox.update({
      where: { id: mailbox.id },
      data: {
        status: "ACTIVE",
        provisioningStatus: "SES_SENDER_ONLY",
        outboundEnabled: true,
        senderIdentityEnabled: true,
      },
    });
    await prisma.mailboxWarmupProfile.updateMany({
      where: { managedMailboxId: mailbox.id },
      data: {
        lifecycleState: "WARMING",
        startedAt: new Date(),
        currentStage: 1,
        currentDailyLimit: warmupDailyLimit(1),
        nextEvaluationAt: new Date(Date.now() + 86_400_000),
        lastDecision: "WARMUP_STARTED",
      },
    });
  }

  await prisma.infrastructureSenderIdentity.upsert({
    where: { workspaceId_fromAddress: { workspaceId: input.workspaceId, fromAddress: mailbox.emailAddress } },
    update: {
      managedMailboxId: mailbox.id,
      managedDomainId: input.domainId,
      displayName: input.displayName ?? mailbox.displayName,
      sesIdentityState: domainVerified ? "VERIFIED" : "PENDING",
      dkimState: dkimVerified ? "VERIFIED" : "PENDING",
      sendingEnabled: sesReady,
      campaignEligible: false,
      dailySendCap: warmupDailyLimit(1),
      healthState: sesReady ? "WARMING" : "AWAITING_DOMAIN",
    },
    create: {
      workspaceId: input.workspaceId,
      managedMailboxId: mailbox.id,
      managedDomainId: input.domainId,
      fromAddress: mailbox.emailAddress,
      displayName: input.displayName ?? mailbox.displayName,
      sesIdentityState: domainVerified ? "VERIFIED" : "PENDING",
      dkimState: dkimVerified ? "VERIFIED" : "PENDING",
      sendingEnabled: sesReady,
      campaignEligible: false,
      dailySendCap: warmupDailyLimit(1),
      healthState: sesReady ? "WARMING" : "AWAITING_DOMAIN",
    },
  });

  return prisma.managedMailbox.findUniqueOrThrow({ where: { id: mailbox.id } });
}
