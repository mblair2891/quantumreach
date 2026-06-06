import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("analysis list and review navigation", () => {
  it("loads analysis records with workspace authorization and workspace-scoped query", () => {
    const service = readFileSync("lib/reports/service.ts", "utf8");
    expect(service).toContain("export async function listAnalysisRecords(workspaceId: string)");
    expect(service).toContain("await requireWorkspaceAccess(workspaceId)");
    expect(service).toContain("prisma.analysisRecord.findMany({");
    expect(service).toContain("where: { workspaceId }");
    expect(service).toContain("include: {");
    expect(service).toContain("analyzerRuns: {");
    expect(service).toContain("executions: { orderBy: { createdAt: \"desc\" }, take: 1 }");
  });

  it("renders the analysis page as a real record list linked to review detail pages", () => {
    const page = readFileSync("app/dashboard/analysis/page.tsx", "utf8");
    expect(page).toContain("listAnalysisRecords(workspace.id)");
    expect(page).toContain("href={`/dashboard/analysis/${record.id}`}");
    expect(page).toContain("records.length === 0");
    expect(page).toContain("Diagnostic / CRM context");
    expect(page).toContain("record.session?.analyzerRuns[0]?.executions[0]?.model");
  });

  it("links generated diagnostic analysis to the review workflow", () => {
    const diagnosticPage = readFileSync("components/dashboard/diagnostic-pages.tsx", "utf8");
    expect(diagnosticPage).toContain("Open analysis review");
    expect(diagnosticPage).toContain("href={`/dashboard/analysis/${latestAnalysis.id}`}");
  });
});
