import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { slugify } from "@/lib/utils";

export const rolePermissions = {
  PLATFORM_OWNER: ["*:*"], WORKSPACE_OWNER: ["*:*"], ADMIN: ["*:*"], MANAGER: ["read:*", "write:*", "manage:crm"],
  STRATEGIST: ["read:*", "write:diagnostics", "write:analysis", "write:reports"], SALES_REP: ["read:crm", "write:crm"],
  DELIVERY: ["read:*", "write:projects"], VIEWER: ["read:*"]
} as const;

export async function requireUserProfile() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? `${userId}@placeholder.local`;
  return prisma.userProfile.upsert({ where: { clerkUserId: userId }, update: { email, firstName: clerkUser?.firstName, lastName: clerkUser?.lastName, imageUrl: clerkUser?.imageUrl }, create: { clerkUserId: userId, email, firstName: clerkUser?.firstName, lastName: clerkUser?.lastName, imageUrl: clerkUser?.imageUrl } });
}

export async function requireWorkspaceAccess(workspaceId?: string) {
  const user = await requireUserProfile();
  const membership = await prisma.workspaceMember.findFirst({ where: { userId: user.id, workspaceId, status: "ACTIVE" }, include: { workspace: true } });
  if (!membership) redirect("/onboarding");
  return { user, membership, workspace: membership.workspace };
}

export function can(roleKey: keyof typeof rolePermissions, action: string, subject: string) {
  const grants: readonly string[] = rolePermissions[roleKey];
  return grants.includes("*:*") || grants.includes(`${action}:*`) || grants.includes(`${action}:${subject}`);
}

export async function createWorkspaceForCurrentUser(name: string) {
  const user = await requireUserProfile();
  const slugBase = slugify(name);
  const workspace = await prisma.workspace.create({ data: { name, slug: `${slugBase}-${Date.now().toString(36)}`, ownerId: user.id, members: { create: { userId: user.id, roleKey: "WORKSPACE_OWNER" } } } });
  return workspace;
}
