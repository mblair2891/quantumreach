import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";

export async function listWorkspaceRecords(workspaceId: string, model: "executiveReport" | "rOIModel" | "proposal" | "implementationProject" | "knowledgeRecord" | "strategicRoadmap") {
  await requireWorkspaceAccess(workspaceId);
  return (prisma[model] as { findMany(args: unknown): Promise<unknown[]> }).findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" }, take: 50 });
}
