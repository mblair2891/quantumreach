import "server-only";
import { prisma } from "@/lib/db/prisma";
import { isOperatorEmail } from "@/lib/admin/operator";

/**
 * Safely remove a test subscriber identity and owned workspace scaffolding.
 * Blocks deletion of operator allowlist emails. Best-effort cascade for private-beta retesting.
 */
export async function deleteTestSubscriberByEmail(email: string, actorEmail: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) throw new Error("A valid email is required.");
  if (isOperatorEmail(normalized)) {
    throw new Error("Refusing to delete an operator allowlist email. Remove them from ADMIN_EMAILS first if intentional.");
  }
  if (!isOperatorEmail(actorEmail)) throw new Error("Operator access is required.");

  const profile = await prisma.userProfile.findUnique({ where: { email: normalized } });
  if (!profile) {
    // Clean orphan auth user if profile already gone
    const authOnly = await prisma.user.findUnique({ where: { email: normalized } });
    if (!authOnly) throw new Error("No subscriber found for that email.");
    await deleteAuthUser(authOnly.id);
    return { deleted: true as const, email: normalized, userProfileId: null, authUserId: authOnly.id, workspaces: [] as string[] };
  }

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: profile.id },
    include: { workspace: true },
  });
  const ownedWorkspaceIds = [
    ...new Set(
      memberships
        .filter((m) => m.roleKey === "WORKSPACE_OWNER" || m.workspace.ownerId === profile.id)
        .map((m) => m.workspaceId),
    ),
  ];

  // Detach orders from user before profile delete; keep order history with purchaserEmail.
  await prisma.customerOrder.updateMany({
    where: { userId: profile.id },
    data: { userId: null },
  });

  // Invalidate unused setup invites so the same email can re-run pay-first setup cleanly.
  await prisma.accountSetupToken.deleteMany({ where: { email: normalized } });

  for (const workspaceId of ownedWorkspaceIds) {
    await deleteOwnedWorkspaceScaffold(workspaceId, profile.id);
  }

  // Non-owned memberships
  await prisma.workspaceMember.deleteMany({ where: { userId: profile.id } });

  await prisma.saasSubscriberProfile.deleteMany({ where: { userId: profile.id } });
  await prisma.skoolMembership.deleteMany({ where: { userId: profile.id } }).catch(() => undefined);
  await prisma.saasSubscription.deleteMany({ where: { userId: profile.id } });
  await prisma.subscriberProvisioningEvent.deleteMany({ where: { userId: profile.id } });
  await prisma.customerNotificationIntent.deleteMany({ where: { userId: profile.id } });
  await prisma.auditLog.deleteMany({ where: { actorId: profile.id } });

  // Affiliate lifecycle for this user
  const participants = await prisma.affiliateParticipant.findMany({ where: { userId: profile.id } });
  for (const participant of participants) {
    await prisma.affiliateMembershipCode.deleteMany({ where: { membershipPeriod: { participantId: participant.id } } });
    await prisma.affiliateMembershipPeriod.deleteMany({ where: { participantId: participant.id } });
    await prisma.affiliateParticipant.delete({ where: { id: participant.id } }).catch(() => undefined);
  }

  const authUserId = profile.authUserId;
  await prisma.userProfile.delete({ where: { id: profile.id } });
  if (authUserId) await deleteAuthUser(authUserId);
  else {
    const byEmail = await prisma.user.findUnique({ where: { email: normalized } });
    if (byEmail) await deleteAuthUser(byEmail.id);
  }

  return {
    deleted: true as const,
    email: normalized,
    userProfileId: profile.id,
    authUserId,
    workspaces: ownedWorkspaceIds,
  };
}

async function deleteAuthUser(authUserId: string) {
  await prisma.session.deleteMany({ where: { userId: authUserId } });
  await prisma.account.deleteMany({ where: { userId: authUserId } });
  await prisma.user.delete({ where: { id: authUserId } }).catch(() => undefined);
}

async function deleteOwnedWorkspaceScaffold(workspaceId: string, ownerUserId: string) {
  // Only delete if this user is the sole owner path for private-beta test workspaces.
  const otherMembers = await prisma.workspaceMember.count({
    where: { workspaceId, userId: { not: ownerUserId } },
  });
  if (otherMembers > 0) {
    await prisma.workspaceMember.deleteMany({ where: { workspaceId, userId: ownerUserId } });
    await prisma.workspace.updateMany({ where: { id: workspaceId, ownerId: ownerUserId }, data: { ownerId: null } });
    return;
  }

  await prisma.saasSubscriptionItem.deleteMany({ where: { workspaceId } });
  await prisma.saasSubscription.deleteMany({ where: { workspaceId } });
  await prisma.workspaceBranding.deleteMany({ where: { workspaceId } });
  await prisma.saasWorkspaceProfile.deleteMany({ where: { workspaceId } });
  await prisma.infrastructureOrder.updateMany({ where: { workspaceId }, data: { workspaceId: null } });
  await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
  await prisma.workspace.delete({ where: { id: workspaceId } }).catch(async () => {
    // Workspace may have CRM data; archive instead of hard-failing the subscriber wipe.
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { status: "ARCHIVED", name: `[deleted-test] ${workspaceId.slice(-6)}`, ownerId: null },
    });
  });
}
