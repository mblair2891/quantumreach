import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getBetterAuthSession } from "@/lib/auth/session";
import { createWorkspaceWithUniqueSlug } from "@/lib/workspaces/slug";
export { can, rolePermissions, type WorkspaceRole } from "@/lib/auth/permissions";

function splitName(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

/** Optional profile for public pages (no redirect). */
export async function getOptionalUserProfile() {
  const authSession = await getBetterAuthSession();
  if (!authSession) return null;
  return ensureUserProfileForAuthUser(authSession.user);
}

/**
 * Resolve or create the app UserProfile for the current Better Auth session.
 * Redirects to /sign-in when unauthenticated.
 */
export async function requireUserProfile() {
  const authSession = await getBetterAuthSession();
  if (!authSession) redirect("/sign-in");
  return ensureUserProfileForAuthUser(authSession.user);
}

export async function ensureUserProfileForAuthUser(user: { id: string; email: string; name?: string | null; image?: string | null }) {
  const email = user.email.trim().toLowerCase();
  if (!email) throw new Error("AUTH_USER_EMAIL_REQUIRED");
  const { firstName, lastName } = splitName(user.name);
  const imageUrl = user.image ?? null;

  const byAuth = await prisma.userProfile.findUnique({ where: { authUserId: user.id } });
  if (byAuth) {
    return prisma.userProfile.update({
      where: { id: byAuth.id },
      data: {
        email,
        firstName: firstName ?? byAuth.firstName,
        lastName: lastName ?? byAuth.lastName,
        imageUrl: imageUrl ?? byAuth.imageUrl,
      },
    });
  }

  const byEmail = await prisma.userProfile.findUnique({ where: { email } });
  if (byEmail) {
    return prisma.userProfile.update({
      where: { id: byEmail.id },
      data: {
        authUserId: user.id,
        firstName: firstName ?? byEmail.firstName,
        lastName: lastName ?? byEmail.lastName,
        imageUrl: imageUrl ?? byEmail.imageUrl,
      },
    });
  }

  return prisma.userProfile.create({
    data: {
      authUserId: user.id,
      email,
      firstName,
      lastName,
      imageUrl,
    },
  });
}

export async function getActiveWorkspaceMembershipForUser(userId: string, workspaceId?: string) {
  return prisma.workspaceMember.findFirst({
    where: { userId, workspaceId, status: "ACTIVE", workspace: { status: "ACTIVE" } },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function requireWorkspaceAccess(workspaceId?: string) {
  const user = await requireUserProfile();
  const membership = await getActiveWorkspaceMembershipForUser(user.id, workspaceId);
  if (!membership) redirect("/onboarding");
  return { user, membership, workspace: membership.workspace };
}

export async function createWorkspaceForCurrentUser(name: string) {
  const user = await requireUserProfile();
  const existingMembership = await getActiveWorkspaceMembershipForUser(user.id);
  if (existingMembership) return existingMembership.workspace;

  return createWorkspaceWithUniqueSlug({
    name,
    slugBase: name,
    ownerId: user.id,
    members: { create: { userId: user.id, roleKey: "WORKSPACE_OWNER" } },
  });
}

export async function requireWorkspaceAdmin(workspaceId?: string) {
  const context = await requireWorkspaceAccess(workspaceId);
  if (!["WORKSPACE_OWNER", "ADMIN"].includes(String(context.membership.roleKey))) {
    throw new Error("Workspace admin access is required.");
  }
  return context;
}
