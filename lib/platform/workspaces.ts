import { prisma } from "@/lib/db/prisma";
import { slugify } from "@/lib/utils";

const activeStatuses = ["ACTIVE", "TRIALING"] as const;

export type WorkspaceDirectoryFilter = "ALL" | "ACTIVE" | "SUSPENDED" | "STUDENT_SUBSCRIBER" | "DIRECT_CUSTOMER" | "REFERRED_CLIENT_COMPANY" | "INTERNAL";

export async function getWorkspaceDirectory(operatorUserId: string, query = "", filter: WorkspaceDirectoryFilter = "ALL") {
  const [workspaces, profiles, provisioning, subscriberProfiles] = await Promise.all([
    prisma.workspace.findMany({ include: { owner: true, members: { include: { user: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.saasWorkspaceProfile.findMany(),
    prisma.workspaceInfrastructureProvisioning.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.saasSubscriberProfile.findMany(),
  ]);
  const profilesByWorkspace = new Map(profiles.map((profile) => [profile.workspaceId, profile]));
  const provisioningByWorkspace = new Map<string, (typeof provisioning)[number]>();
  for (const event of provisioning) if (!provisioningByWorkspace.has(event.workspaceId)) provisioningByWorkspace.set(event.workspaceId, event);
  const subscriberByWorkspace = new Map(subscriberProfiles.filter((profile) => profile.workspaceId).map((profile) => [profile.workspaceId!, profile]));
  const itemGroups = await prisma.saasSubscriptionItem.findMany({ include: { commerceProduct: true }, where: { status: { in: [...activeStatuses] } } });
  const itemsByWorkspace = new Map<string, typeof itemGroups>();
  for (const item of itemGroups) itemsByWorkspace.set(item.workspaceId, [...(itemsByWorkspace.get(item.workspaceId) ?? []), item]);
  const needle = query.trim().toLowerCase();
  return workspaces.map((workspace) => {
    const profile = profilesByWorkspace.get(workspace.id);
    const items = itemsByWorkspace.get(workspace.id) ?? [];
    const owner = workspace.owner ?? workspace.members.find((member) => member.roleKey === "WORKSPACE_OWNER")?.user ?? null;
    const suspended = workspace.status !== "ACTIVE" || Boolean(profile?.suspendedAt) || Boolean(subscriberByWorkspace.get(workspace.id)?.suspendedAt);
    const type = profile?.workspaceType ?? "Unavailable";
    const searchable = [workspace.name, workspace.id, owner?.email, owner?.firstName, owner?.lastName].filter(Boolean).join(" ").toLowerCase();
    return { workspace, profile, items, owner, type, suspended, provisioning: provisioningByWorkspace.get(workspace.id), isMine: workspace.members.some((member) => member.userId === operatorUserId && member.status === "ACTIVE"), userCount: workspace.members.filter((member) => member.status === "ACTIVE").length, searchable };
  }).filter((row) => {
    if (needle && !row.searchable.includes(needle)) return false;
    if (filter === "ACTIVE") return !row.suspended;
    if (filter === "SUSPENDED") return row.suspended;
    return filter === "ALL" || row.type === filter;
  });
}

export async function getWorkspaceBootstrapDiagnostic(userId: string) {
  const [membership, provisioning] = await Promise.all([
    prisma.workspaceMember.findFirst({ where: { userId, status: "ACTIVE" }, select: { workspaceId: true } }),
    prisma.subscriberProvisioningEvent.findFirst({ where: { userId }, select: { workspaceId: true, status: true }, orderBy: { updatedAt: "desc" } }),
  ]);
  return { hasMembership: Boolean(membership), hasProvisioning: Boolean(provisioning), provisioningWorkspaceId: provisioning?.workspaceId ?? null };
}

export async function bootstrapOperatorWorkspace(userId: string, name: string) {
  const membership = await prisma.workspaceMember.findFirst({ where: { userId, status: "ACTIVE" }, include: { workspace: true } });
  if (membership) return membership.workspace;
  const base = slugify(name) || "operator-workspace";
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({ data: { name, slug: `${base}-${Date.now().toString(36)}`, ownerId: userId } });
    await tx.workspaceMember.create({ data: { workspaceId: workspace.id, userId, roleKey: "WORKSPACE_OWNER" } });
    await tx.saasWorkspaceProfile.create({ data: { workspaceId: workspace.id, workspaceType: "INTERNAL" } });
    return workspace;
  });
}
