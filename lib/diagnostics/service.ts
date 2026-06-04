import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";
import { diagnosticSchema, transcriptContextSchema } from "@/lib/validation/schemas";
import { audit } from "@/lib/audit/service";
import { getCrmRecordContext, type RelatedType } from "@/lib/crm/service";
import { toPrismaJson } from "@/lib/db/json";

export async function createDiagnosticSession(workspaceId: string, input: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const data = diagnosticSchema.parse(input);
  const record = await prisma.diagnosticSession.create({ data: { workspaceId, title: data.title, relatedType: data.relatedType, relatedId: data.relatedId, status: data.transcript ? "TRANSCRIPT_READY" : "DRAFT", createdById: user.id, transcripts: data.transcript ? { create: { workspaceId, content: data.transcript, createdById: user.id } } : undefined } });
  await audit(workspaceId, "create", "DiagnosticSession", record.id, user.id, { relatedType: data.relatedType, relatedId: data.relatedId });
  return record;
}

export async function startDiagnosticFromRecord(workspaceId: string, relatedType: RelatedType, relatedId: string, title: string) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const context = await getCrmRecordContext(workspaceId, relatedType, relatedId);
  if (!context) notFound();
  const session = await prisma.diagnosticSession.create({ data: { workspaceId, title, relatedType, relatedId, status: "IN_PROGRESS", createdById: user.id } });
  await prisma.activity.create({ data: { workspaceId, relatedType, relatedId, type: "DIAGNOSTIC", title: "Diagnostic session started", description: title, createdById: user.id } });
  await audit(workspaceId, "create", "DiagnosticSession", session.id, user.id, { relatedType, relatedId });
  redirect(`/dashboard/diagnostics/${session.id}`);
}

export async function listDiagnostics(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId);
  return prisma.diagnosticSession.findMany({ where: { workspaceId, status: { not: "ARCHIVED" } }, include: { analyses: true, transcripts: { orderBy: { updatedAt: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" } });
}

export async function getDiagnosticDetail(workspaceId: string, id: string) {
  await requireWorkspaceAccess(workspaceId);
  const session = await prisma.diagnosticSession.findFirst({ where: { id, workspaceId }, include: { transcripts: { orderBy: { updatedAt: "desc" } }, analyzerRuns: { orderBy: { createdAt: "desc" }, include: { executions: { orderBy: { createdAt: "desc" }, take: 1 }, artifacts: { orderBy: { createdAt: "desc" }, take: 1 } } }, analyses: { orderBy: { updatedAt: "desc" }, include: { constraints: true, bottlenecks: true, recommendations: true } } } });
  if (!session) notFound();
  const crmContext = await getCrmRecordContext(workspaceId, session.relatedType, session.relatedId);
  return { session, crmContext };
}

export async function saveTranscriptContext(workspaceId: string, sessionId: string, input: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const session = await prisma.diagnosticSession.findFirst({ where: { id: sessionId, workspaceId } });
  if (!session) notFound();
  const data = transcriptContextSchema.parse(input);
  const content = [data.transcript ? `Transcript:\n${data.transcript}` : null, data.discoveryNotes ? `Discovery notes:\n${data.discoveryNotes}` : null, data.businessContext ? `Business context:\n${data.businessContext}` : null].filter(Boolean).join("\n\n");
  const transcript = await prisma.transcript.create({ data: { workspaceId, sessionId, content, source: "manual_context_entry", discoveryNotes: data.discoveryNotes || undefined, businessContext: data.businessContext || undefined, createdById: user.id } });
  await prisma.diagnosticSession.update({ where: { id: sessionId }, data: { status: "TRANSCRIPT_READY", summary: data.businessContext || session.summary } });
  await audit(workspaceId, "save_transcript_context", "DiagnosticSession", sessionId, user.id, { transcriptId: transcript.id });
  return transcript;
}

export function buildDiagnosticAnalyzerInput({ workspace, session, crmContext }: { workspace: { id: string; name: string }; session: Awaited<ReturnType<typeof getDiagnosticDetail>>["session"]; crmContext: unknown }) {
  const latestTranscript = session.transcripts[0];
  return toPrismaJson({ workspace: { id: workspace.id, name: workspace.name }, diagnosticSession: { id: session.id, title: session.title, status: session.status, relatedType: session.relatedType, relatedId: session.relatedId }, crmContext, transcriptContext: latestTranscript ? { content: latestTranscript.content, discoveryNotes: latestTranscript.discoveryNotes, businessContext: latestTranscript.businessContext, source: latestTranscript.source } : null, analyzer: { name: "Diagnostic Summary + Constraint Extraction", expectedOutput: { summary: "string", constraints: [], bottlenecks: [], recommendations: [], risks: [], assumptions: [] } } });
}
