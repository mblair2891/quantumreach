import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readablePhases, readableSections } from "@/lib/reports/service";

describe("Phase 3 deliverable workflow protections", () => {
  it("renders deliverable content as readable sections rather than raw JSON", () => {
    expect(readableSections({ executiveSummary: "Focus the operating cadence.", nextSteps: ["Review", "Approve"] })).toEqual([
      { title: "executiveSummary", body: "Focus the operating cadence." },
      { title: "nextSteps", body: "Review\nApprove" }
    ]);
    expect(readablePhases([{ name: "Phase 1", objective: "Stabilize follow-up" }])).toEqual([{ name: "Phase 1", objective: "Stabilize follow-up" }]);
  });

  it("keeps Phase 3 loaders and generators workspace-scoped", () => {
    const source = readFileSync("lib/reports/service.ts", "utf8");
    for (const lookup of [
      "prisma.analysisRecord.findFirst({ where: { id, workspaceId }",
      "prisma.executiveReport.findFirst({ where: { id, workspaceId }",
      "prisma.strategicRoadmap.findFirst({ where: { id, workspaceId }",
      "prisma.proposal.findFirst({ where: { id, workspaceId }",
      "prisma.opportunity.findFirst({ where: { id: opportunityId, workspaceId }"
    ]) {
      expect(source).toContain(lookup);
    }
  });

  it("blocks report, roadmap, and proposal generation unless analysis is reviewed or final", () => {
    const source = readFileSync("lib/reports/service.ts", "utf8");
    expect(source).toContain("Analysis must be REVIEWED or FINAL before generating deliverables.");
    expect(source).toContain("requireReviewedAnalysis(analysis)");
  });
});
