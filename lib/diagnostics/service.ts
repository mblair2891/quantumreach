import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";
import { diagnosticSchema } from "@/lib/validation/schemas";
import { audit } from "@/lib/audit/service";

export async function createDiagnosticSession(workspaceId: string, input: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const data = diagnosticSchema.parse(input);
  const record = await prisma.diagnosticSession.create({ data: { workspaceId, title: data.title, relatedType: data.relatedType, relatedId: data.relatedId, status: data.transcript ? "TRANSCRIPT_READY" : "DRAFT", createdById: user.id, transcripts: data.transcript ? { create: { workspaceId, content: data.transcript, createdById: user.id } } : undefined } });
  await audit(workspaceId, "create", "DiagnosticSession", record.id, user.id);
  return record;
}
