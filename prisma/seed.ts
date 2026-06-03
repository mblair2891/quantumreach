import { PrismaClient, WorkspaceRoleKey } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const systemUser = await prisma.userProfile.upsert({ where: { clerkUserId: "seed-user" }, update: {}, create: { clerkUserId: "seed-user", email: "seed@example.com", firstName: "Seed", lastName: "User" } });
  const workspace = await prisma.workspace.upsert({ where: { slug: "demo-workspace" }, update: {}, create: { name: "Demo Workspace", slug: "demo-workspace", ownerId: systemUser.id, members: { create: { userId: systemUser.id, roleKey: WorkspaceRoleKey.WORKSPACE_OWNER } } } });
  await prisma.pipeline.upsert({ where: { id: "demo-pipeline" }, update: {}, create: { id: "demo-pipeline", workspaceId: workspace.id, name: "Advisory Pipeline", isDefault: true, stages: { create: [{ workspaceId: workspace.id, name: "Qualified", position: 1, probability: 20 }, { workspaceId: workspace.id, name: "Diagnostic", position: 2, probability: 40 }, { workspaceId: workspace.id, name: "Proposal", position: 3, probability: 70 }, { workspaceId: workspace.id, name: "Won", position: 4, probability: 100 }] } } });
  for (const key of ["diagnostic_summary", "constraint_extraction", "roi_model", "executive_report", "strategic_roadmap"]) await prisma.analyzerDefinition.upsert({ where: { workspaceId_key: { workspaceId: workspace.id, key } }, update: {}, create: { workspaceId: workspace.id, key, name: key.replaceAll("_", " ") } });
}
main().finally(async () => prisma.$disconnect());
