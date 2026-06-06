import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("analysis review status controls", () => {
  it("renders status choices as a local Review Status selector with a nearby update action", () => {
    const detailPage = readFileSync("components/dashboard/detail-page.tsx", "utf8");
    const statusForm = readFileSync("components/dashboard/analysis-status-form.tsx", "utf8");

    expect(detailPage).toContain("<AnalysisStatusForm currentStatus={analysis.status as AnalysisReviewStatus} action={updateStatus} />");
    expect(statusForm).toContain("Review Status");
    expect(statusForm).toContain("Select the appropriate review state, then click Update Status to save the change.");
    expect(statusForm).toContain("Needs Review");
    expect(statusForm).toContain("Reviewed");
    expect(statusForm).toContain("Final");
    expect(statusForm).toContain("Rejected");
    expect(statusForm).toContain("Update Status");
  });

  it("distinguishes current saved status from selected unsaved status", () => {
    const statusForm = readFileSync("components/dashboard/analysis-status-form.tsx", "utf8");

    expect(statusForm).toContain("const hasChange = selectedStatus !== savedStatus");
    expect(statusForm).toContain("Current:");
    expect(statusForm).toContain("Selected:");
    expect(statusForm).toContain("Unsaved status change.");
    expect(statusForm).toContain("disabled={!hasChange || pending}");
    expect(statusForm).toContain("No status change");
  });

  it("keeps status updates separate from analysis content edits and preserves status service protections", () => {
    const detailPage = readFileSync("components/dashboard/detail-page.tsx", "utf8");
    const service = readFileSync("lib/reports/service.ts", "utf8");

    expect(detailPage).toContain("await setAnalysisStatus(wid, id, nextStatus)");
    expect(detailPage).toContain("await updateAnalysis(wid, id, Object.fromEntries(formData))");
    expect(service).toContain("await requireWorkspaceAccess(workspaceId)");
    expect(service).toContain("prisma.analysisRecord.findFirst({ where: { id, workspaceId } })");
    expect(service).toContain("reviewedById: user.id, reviewedAt: now");
    expect(service).toContain("finalizedById: user.id, finalizedAt: now");
    expect(service).toContain("analysis.rejected");
    expect(service).toContain("await audit(workspaceId");
  });
});
