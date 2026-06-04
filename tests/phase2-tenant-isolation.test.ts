import { beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.fn(async (workspaceId?: string) => ({ user: { id: "user_1" }, workspace: { id: workspaceId ?? "workspace_1", name: "Workspace" }, membership: { id: "member_1" } }));
const notFound = vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); });
const redirect = vi.fn((path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); });
const audit = vi.fn(async () => ({}));
const provider = { runStructured: vi.fn(async () => ({ model: "gpt-test", rawText: JSON.stringify({ summary: "Executive summary", constraints: [{ label: "Manual reporting", impact: "Cycle time", severity: "HIGH", evidence: "Transcript" }], bottlenecks: [{ label: "Approval delay", description: "Decisions wait for one owner", severity: "MEDIUM" }], recommendations: [{ title: "Define review lane", rationale: "Removes ambiguity", expectedOutcome: "Faster approvals", priority: "HIGH" }], risks: [], assumptions: [] }), json: { summary: "Executive summary", constraints: [{ label: "Manual reporting", impact: "Cycle time", severity: "HIGH", evidence: "Transcript" }], bottlenecks: [{ label: "Approval delay", description: "Decisions wait for one owner", severity: "MEDIUM" }], recommendations: [{ title: "Define review lane", rationale: "Removes ambiguity", expectedOutcome: "Faster approvals", priority: "HIGH" }], risks: [], assumptions: [] } })) };

const prisma = {
  company: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  contact: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  lead: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  opportunity: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  pipeline: { count: vi.fn(), findMany: vi.fn() },
  pipelineStage: { count: vi.fn() },
  activity: { create: vi.fn(), findMany: vi.fn() },
  note: { create: vi.fn(), findMany: vi.fn() },
  task: { create: vi.fn(), findMany: vi.fn() },
  followUp: { create: vi.fn(), findMany: vi.fn() },
  diagnosticSession: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  transcript: { create: vi.fn() },
  analyzerDefinition: { upsert: vi.fn() },
  analyzerRun: { create: vi.fn(), update: vi.fn() },
  aIExecution: { create: vi.fn(), update: vi.fn() },
  aIOutputArtifact: { create: vi.fn() },
  analysisRecord: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  constraint: { deleteMany: vi.fn(), createMany: vi.fn() },
  bottleneck: { deleteMany: vi.fn(), createMany: vi.fn() },
  recommendation: { deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops))
};

vi.mock("next/navigation", () => ({ notFound, redirect }));
vi.mock("@/lib/auth/rbac", () => ({ requireWorkspaceAccess: access }));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/audit/service", () => ({ audit }));
vi.mock("@/lib/ai/provider", () => ({ getAIProvider: () => provider }));

describe("Phase 2 tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.company.count.mockResolvedValue(1);
    prisma.contact.count.mockResolvedValue(1);
    prisma.lead.count.mockResolvedValue(1);
    prisma.pipeline.count.mockResolvedValue(1);
    prisma.pipelineStage.count.mockResolvedValue(1);
    prisma.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
  });

  it("loads CRM detail records with workspaceId and never id alone", async () => {
    const { getCompanyDetail } = await import("@/lib/crm/service");
    prisma.company.findFirst.mockResolvedValue({ id: "company_1", workspaceId: "workspace_1" });
    await getCompanyDetail("workspace_1", "company_1");
    expect(access).toHaveBeenCalledWith("workspace_1");
    expect(prisma.company.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "company_1", workspaceId: "workspace_1" } }));
  });

  it("returns not found for cross-workspace CRM detail attempts without leaking existence", async () => {
    const { getContactDetail } = await import("@/lib/crm/service");
    prisma.contact.findFirst.mockResolvedValue(null);
    await expect(getContactDetail("workspace_1", "contact_from_other_workspace")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(prisma.contact.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "contact_from_other_workspace", workspaceId: "workspace_1" } }));
  });

  it("archives only after a workspace-scoped detail lookup", async () => {
    const { archiveCrmRecord } = await import("@/lib/crm/service");
    prisma.opportunity.findFirst.mockResolvedValue({ id: "opp_1", workspaceId: "workspace_1" });
    prisma.opportunity.update.mockResolvedValue({ id: "opp_1" });
    await expect(archiveCrmRecord("workspace_1", "opportunities", "opp_1")).rejects.toThrow("NEXT_REDIRECT:/dashboard/opportunities");
    expect(prisma.opportunity.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "opp_1", workspaceId: "workspace_1" } }));
    expect(prisma.opportunity.update).toHaveBeenCalledWith({ where: { id: "opp_1" }, data: { status: "ARCHIVED" } });
  });

  it("creates activity records scoped to the same workspace and related record", async () => {
    const { addTask } = await import("@/lib/crm/activity-service");
    prisma.task.create.mockResolvedValue({ id: "task_1" });
    prisma.activity.create.mockResolvedValue({ id: "activity_1" });
    await addTask("workspace_1", "Company", "company_1", { title: "Review constraints" });
    expect(prisma.task.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ workspaceId: "workspace_1", relatedType: "Company", relatedId: "company_1", createdById: "user_1" }) }));
  });

  it("diagnostic creation validates workspace access and links CRM context", async () => {
    const { startDiagnosticFromRecord } = await import("@/lib/diagnostics/service");
    prisma.company.findFirst.mockResolvedValue({ id: "company_1", name: "Acme" });
    prisma.diagnosticSession.create.mockResolvedValue({ id: "diag_1" });
    prisma.activity.create.mockResolvedValue({ id: "activity_1" });
    await expect(startDiagnosticFromRecord("workspace_1", "Company", "company_1", "Company diagnostic: Acme")).rejects.toThrow("NEXT_REDIRECT:/dashboard/diagnostics/diag_1");
    expect(prisma.company.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "company_1", workspaceId: "workspace_1" } }));
    expect(prisma.diagnosticSession.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ workspaceId: "workspace_1", relatedType: "Company", relatedId: "company_1", createdById: "user_1" }) }));
  });

  it("analyzer runs enforce diagnostic session workspace before calling OpenAI", async () => {
    const { runDiagnosticSummaryAnalyzer } = await import("@/lib/ai/orchestration");
    prisma.diagnosticSession.findFirst.mockResolvedValueOnce({ id: "diag_1", workspaceId: "workspace_1", title: "Diagnostic", status: "TRANSCRIPT_READY", relatedType: "Company", relatedId: "company_1", transcripts: [{ id: "tr_1", content: "Transcript" }] }).mockResolvedValueOnce({ id: "diag_1" });
    prisma.company.findFirst.mockResolvedValue({ id: "company_1", name: "Acme" });
    prisma.analyzerDefinition.upsert.mockResolvedValue({ id: "definition_1" });
    prisma.analyzerRun.create.mockResolvedValue({ id: "run_1" });
    prisma.aIExecution.create.mockResolvedValue({ id: "exec_1" });
    prisma.analyzerRun.update.mockResolvedValue({ id: "run_1", status: "SUCCEEDED" });
    prisma.aIExecution.update.mockResolvedValue({ id: "exec_1" });
    prisma.aIOutputArtifact.create.mockResolvedValue({ id: "artifact_1" });
    prisma.analysisRecord.findFirst.mockResolvedValue(null);
    prisma.analysisRecord.create.mockResolvedValue({ id: "analysis_1" });
    prisma.constraint.deleteMany.mockResolvedValue({ count: 0 });
    prisma.bottleneck.deleteMany.mockResolvedValue({ count: 0 });
    prisma.recommendation.deleteMany.mockResolvedValue({ count: 0 });
    prisma.constraint.createMany.mockResolvedValue({ count: 1 });
    prisma.bottleneck.createMany.mockResolvedValue({ count: 1 });
    prisma.recommendation.createMany.mockResolvedValue({ count: 1 });
    prisma.diagnosticSession.update.mockResolvedValue({ id: "diag_1" });
    await runDiagnosticSummaryAnalyzer("workspace_1", "diag_1");
    expect(prisma.diagnosticSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "diag_1", workspaceId: "workspace_1" } }));
    expect(provider.runStructured).toHaveBeenCalled();
    expect(prisma.analysisRecord.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ workspaceId: "workspace_1", sessionId: "diag_1", status: "NEEDS_REVIEW" }) }));
  });
});
