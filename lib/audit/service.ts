import { prisma } from "@/lib/db/prisma";
import { toPrismaJson } from "@/lib/db/json";

export async function audit(workspaceId: string | null, action: string, entityType: string, entityId?: string, actorId?: string, metadata: Record<string, unknown> = {}) {
  return prisma.auditLog.create({ data: { workspaceId, action, entityType, entityId, actorId, metadata: toPrismaJson(metadata) } });
}
