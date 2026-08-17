import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isOperatorEmail } from "@/lib/admin/operator";
import { freedWorkspaceSlug } from "@/lib/workspaces/slug";

/**
 * Safely remove a test subscriber identity and owned workspace scaffolding.
 * Blocks deletion of operator allowlist emails. Best-effort cascade for private-beta retesting.
 * Hard-deletes owned workspaces when possible; otherwise archives and frees the unique slug
 * so the same business name / email can be re-tested without slug collisions.
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
    const orphanOrderIds = (
      await prisma.customerOrder.findMany({
        where: { purchaserEmail: normalized },
        select: { id: true },
      })
    ).map((order) => order.id);
    await prisma.$transaction(async (tx) => {
      await cleanupAffiliateLifecycle(tx, { email: normalized, orderIds: orphanOrderIds });
    });
    await deleteAuthUser(authOnly.id);
    return { deleted: true as const, email: normalized, userProfileId: null, authUserId: authOnly.id, workspaces: [] as string[] };
  }

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: profile.id },
    include: { workspace: true },
  });
  const ownedViaMembership = memberships
    .filter((m) => m.roleKey === "WORKSPACE_OWNER" || m.workspace.ownerId === profile.id)
    .map((m) => m.workspaceId);
  // Also catch orphan owner rows (membership already removed in a prior partial wipe).
  const ownedDirect = await prisma.workspace.findMany({
    where: { ownerId: profile.id },
    select: { id: true },
  });
  const ownedWorkspaceIds = [...new Set([...ownedViaMembership, ...ownedDirect.map((w) => w.id)])];

  const relatedOrderIds = (
    await prisma.customerOrder.findMany({
      where: { OR: [{ userId: profile.id }, { purchaserEmail: normalized }] },
      select: { id: true },
    })
  ).map((order) => order.id);

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

  await prisma.$transaction(async (tx) => {
    await cleanupAffiliateLifecycle(tx, {
      email: normalized,
      userId: profile.id,
      orderIds: relatedOrderIds,
    });
  });

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

/**
 * Delete referral attributions before membership codes. Codes are referenced by
 * AffiliateReferralAttribution_code_fkey (Restrict), so deleting codes first fails.
 */
async function cleanupAffiliateLifecycle(
  db: Prisma.TransactionClient,
  input: { email: string; userId?: string | null; orderIds?: string[] },
) {
  const orderIds = input.orderIds ?? [];
  const referredFilters = [
    ...(input.userId ? [{ customerUserId: input.userId }] : []),
    ...(orderIds.length ? [{ orderId: { in: orderIds } }] : []),
  ];
  if (referredFilters.length) {
    await db.affiliateReferralAttribution.deleteMany({ where: { OR: referredFilters } });
  }

  const participants = await db.affiliateParticipant.findMany({
    where: {
      OR: [...(input.userId ? [{ userId: input.userId }] : []), { email: input.email }],
    },
  });

  for (const participant of participants) {
    const periods = await db.affiliateMembershipPeriod.findMany({
      where: { participantId: participant.id },
      include: { code: { select: { id: true } } },
    });
    const codeIds = periods.flatMap((period) => (period.code ? [period.code.id] : []));
    const periodIds = periods.map((period) => period.id);

    if (codeIds.length || periodIds.length) {
      await db.affiliateReferralAttribution.deleteMany({
        where: {
          OR: [
            ...(codeIds.length ? [{ affiliateCodeId: { in: codeIds } }] : []),
            ...(periodIds.length ? [{ affiliateMembershipPeriodId: { in: periodIds } }] : []),
          ],
        },
      });
    }

    if (codeIds.length) {
      await db.affiliateMembershipCode.deleteMany({ where: { id: { in: codeIds } } });
    }
    await db.affiliateMembershipPeriod.deleteMany({ where: { participantId: participant.id } });
    await db.affiliateParticipant.delete({ where: { id: participant.id } });
  }
}

async function deleteAuthUser(authUserId: string) {
  await prisma.session.deleteMany({ where: { userId: authUserId } });
  await prisma.account.deleteMany({ where: { userId: authUserId } });
  await prisma.user.delete({ where: { id: authUserId } }).catch(() => undefined);
}

async function deleteOwnedWorkspaceScaffold(workspaceId: string, ownerUserId: string) {
  // Only hard-delete/archive if this user is the sole member path for private-beta test workspaces.
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
  await prisma.customerOrder.updateMany({ where: { workspaceId }, data: { workspaceId: null } });
  await prisma.workspaceMember.deleteMany({ where: { workspaceId } });

  try {
    await prisma.workspace.delete({ where: { id: workspaceId } });
  } catch {
    // Workspace may have CRM/history FKs; archive and free the unique slug so retests can reuse names.
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        status: "ARCHIVED",
        name: `[deleted-test] ${workspaceId.slice(-6)}`,
        slug: freedWorkspaceSlug(workspaceId),
        ownerId: null,
      },
    });
  }
}
