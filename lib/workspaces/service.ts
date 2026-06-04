import { prisma } from "@/lib/db/prisma";
import { createWorkspaceForCurrentUser, requireUserProfile } from "@/lib/auth/rbac";
import { workspaceSchema } from "@/lib/validation/schemas";

export async function listMyWorkspaces() {
  const user = await requireUserProfile();
  return prisma.workspaceMember.findMany({ where: { userId: user.id, status: "ACTIVE" }, include: { workspace: true }, orderBy: { createdAt: "asc" } });
}

export async function getCurrentWorkspace() {
  const memberships = await listMyWorkspaces();
  return memberships[0]?.workspace ?? null;
}

export async function onboardWorkspace(input: unknown) { const parsed = workspaceSchema.parse(input); return createWorkspaceForCurrentUser(parsed.name); }
