import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");

describe("phase 7 workflow polish and operational readiness", () => {
  it("computes a workspace-scoped dashboard summary and next recommended actions", () => {
    const workflows = source("lib/workflows/service.ts");
    expect(workflows).toContain("export async function getWorkflowStatusSummary(workspaceId: string)");
    expect(workflows).toContain("await requireWorkspaceAccess(workspaceId)");
    expect(workflows).toContain("prisma.lead.count({ where: { workspaceId");
    expect(workflows).toContain("Create diagnostic from");
    expect(workflows).toContain("Run analysis on");
    expect(workflows).toContain("Review ${analysesNeedingReview} analysis record");
    expect(workflows).toContain("No active proposal framework found.");
  });

  it("renders required operational dashboard cards without raw JSON", () => {
    const page = source("app/dashboard/page.tsx");
    for (const label of ["Leads by outreach status", "Active outreach campaigns", "Recent calls", "Calls needing transcript", "Diagnostics needing analysis", "Analyses needing review", "Reports / roadmaps / proposals", "Knowledge source coverage", "Next recommended actions", "Production readiness checklist", "Workflow status summary", "Recent activity"]) expect(page).toContain(label);
    expect(page).not.toContain("JSON.stringify");
  });

  it("surfaces knowledge coverage warnings and active temporary test document cautions", () => {
    const knowledge = source("lib/knowledge/service.ts");
    const workflows = source("lib/workflows/service.ts");
    expect(knowledge).toContain("activeExecutionHandoffFrameworkCount");
    expect(knowledge).toContain("doc.title.startsWith(\"Test\")");
    expect(knowledge).toContain("Test source documents are active and may influence production outputs.");
    expect(workflows).toContain("Archive temporary test source documents.");
    expect(workflows).toContain("Draft source documents need review.");
  });

  it("provides production readiness checklist items", () => {
    const workflows = source("lib/workflows/service.ts");
    for (const item of ["Active global doctrine exists", "Active diagnostic framework exists", "Active report framework exists", "Active roadmap framework exists", "Active proposal framework exists", "At least one lead exists", "At least one outreach campaign exists", "At least one call has transcript", "At least one analysis has been reviewed", "No temporary test documents are active", "No major required setup missing"]) expect(workflows).toContain(item);
  });

  it("improves empty states with next actions for core workflow areas", () => {
    const empty = source("components/dashboard/empty-state.tsx");
    for (const key of ["leads", "outreach", "calls", "diagnostics", "analysis", "reports", "roadmaps", "proposals", "knowledge"]) expect(empty).toContain(`${key}:`);
    expect(empty).toContain("Operating flow:");
    expect(empty).toContain("Next:");
    expect(source("components/dashboard/call-pages.tsx")).toContain("emptyStateCopy.calls");
    expect(source("components/dashboard/diagnostic-pages.tsx")).toContain("emptyStateCopy.diagnostics");
  });

  it("adds workflow hub links across call, diagnostic, analysis, and deliverable details", () => {
    expect(source("components/dashboard/call-pages.tsx")).toContain("Linked outputs");
    expect(source("components/dashboard/diagnostic-pages.tsx")).toContain("Open linked call");
    expect(source("components/dashboard/detail-page.tsx")).toContain("Workflow links");
    expect(source("components/dashboard/detail-page.tsx")).toContain("View source analysis");
    expect(source("lib/diagnostics/service.ts")).toContain("callSession: true");
    expect(source("lib/reports/service.ts")).toContain("session: { include: { callSession: true } }");
  });

  it("adds test data cleanup guidance and filters on knowledge page", () => {
    const page = source("app/dashboard/knowledge/page.tsx");
    expect(page).toContain("Test data cleanup guidance");
    expect(page).toContain("Used knowledge documents cannot be permanently deleted because they preserve source history.");
    expect(page).toContain("filter === \"test\"");
    expect(page).toContain("filter === \"used\"");
  });
});
