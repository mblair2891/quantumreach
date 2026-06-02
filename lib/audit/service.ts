import { prisma } from "@/lib/db/prisma";

export async function audit(workspaceId: string, action: string, entityType: string, entityId?: string, actorId?: string, metadata: Record<string, unknown> = {}) {
  return prisma.auditLog.create({ data: { workspaceId, action, entityType, entityId, actorId, metadata } });
}
