import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");

describe("phase 6 call transcript diagnostic workflow", () => {
  it("lists and loads call sessions with workspace-scoped service queries", () => {
    const service = source("lib/workflows/service.ts");
    expect(service).toContain("export async function listCallSessions(workspaceId: string)");
    expect(service).toContain("await requireWorkspaceAccess(workspaceId)");
    expect(service).toContain("where: { workspaceId }");
    expect(service).toContain("export async function getCallSessionDetail(workspaceId: string, id: string)");
    expect(service).toContain("where: { id, workspaceId }");
    expect(service).toContain("if (!call) notFound()");
  });

  it("validates linked CRM records are in the same workspace before creating or updating calls", () => {
    const service = source("lib/workflows/service.ts");
    expect(service).toContain("assertLead(workspaceId, leadId)");
    expect(service).toContain("assertContact(workspaceId, contactId)");
    expect(service).toContain("assertCompany(workspaceId, companyId)");
    expect(service).toContain("assertOpportunity(workspaceId, opportunityId)");
    expect(service).toContain("Lead is not available in this workspace.");
    expect(service).toContain("Opportunity is not available in this workspace.");
  });

  it("requires workspace access for transcript save and status updates", () => {
    const service = source("lib/workflows/service.ts");
    expect(service).toContain("export async function saveCallTranscript(workspaceId: string, id: string, input: unknown)");
    expect(service).toContain("const { user } = await requireWorkspaceAccess(workspaceId)");
    expect(service).toContain("export async function updateCallStatus(workspaceId: string, id: string, status: string)");
    expect(service).toContain("call_session.status_updated");
    expect(service).toContain("call_session.transcript_updated");
  });

  it("creates diagnostics from call transcripts and prevents duplicate diagnostic creation", () => {
    const service = source("lib/workflows/service.ts");
    expect(service).toContain("export async function createDiagnosticFromCallSession(workspaceId: string, callSessionId: string)");
    expect(service).toContain("if (!call.transcriptText) throw new Error(\"Transcript text is required before creating a diagnostic.\")");
    expect(service).toContain("if (existing) return existing");
    expect(service).toContain("callSessionId: call.id");
    expect(service).toContain("content: call.transcriptText");
    expect(service).toContain("status: \"DIAGNOSTIC_CREATED\"");
  });

  it("surfaces linked diagnostics, latest analysis, and downstream outputs on call detail", () => {
    const service = source("lib/workflows/service.ts");
    const page = source("components/dashboard/call-pages.tsx");
    expect(service).toContain("reports: { orderBy: { updatedAt: \"desc\" } }");
    expect(service).toContain("roadmaps: { orderBy: { updatedAt: \"desc\" } }");
    expect(service).toContain("proposals: { orderBy: { updatedAt: \"desc\" } }");
    expect(page).toContain("Linked outputs");
    expect(page).toContain("/dashboard/reports/${report.id}");
    expect(page).toContain("/dashboard/roadmaps/${roadmap.id}");
    expect(page).toContain("/dashboard/proposals/${proposal.id}");
  });

  it("keeps the analyzer path source-of-truth guided for call-created diagnostics", () => {
    const callService = source("lib/workflows/service.ts");
    const diagnostics = source("components/dashboard/diagnostic-pages.tsx");
    expect(callService).toContain("transcripts: { create: { workspaceId, content: call.transcriptText");
    expect(diagnostics).toContain("runDiagnosticSummaryAnalyzer(workspace.id, id)");
    expect(diagnostics).toContain("Sources used");
    expect(diagnostics).toContain("getSourcesForEntity(workspace.id, \"AnalyzerRun\", latestRun.id)");
  });

  it("renders required call UI without raw JSON presentation", () => {
    const page = source("components/dashboard/call-pages.tsx");
    expect(page).toContain("Create diagnostic from transcript");
    expect(page).toContain("Transcript preview");
    expect(page).toContain("CRM context");
    expect(page).toContain("Recent activity");
    expect(page).toContain("Optional .txt/.md transcript file");
    expect(page).not.toContain("JSON.stringify");
  });

  it("documents the non-destructive status migration and deployment command", () => {
    const schema = source("prisma/schema.prisma");
    const migration = source("prisma/migrations/20260608090000_phase_6_call_transcript_workflow/migration.sql");
    const docs = source("docs/phase-6-call-transcript-workflow.md");
    expect(schema).toContain("ANALYZED");
    expect(migration).toContain("ALTER TYPE \"CallSessionStatus\" ADD VALUE IF NOT EXISTS 'ANALYZED'");
    expect(docs).toContain("npm run prisma:deploy");
  });
});
