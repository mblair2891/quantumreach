import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildExecutiveReportSections, buildProposalFallback, buildRoadmapFallback, readablePhases, readableSections } from "@/lib/reports/service";

const reviewedAnalysisInput = {
  summary: "Follow-up ownership is inconsistent, qualified pipeline is hard to inspect, and stalled deals are not escalated quickly enough.",
  constraints: [
    { label: "No single accountable owner for post-demo follow-up", impact: "High-value opportunities wait multiple days for action" },
    { label: "Pipeline fields are inconsistently updated", impact: "Leadership cannot reliably forecast risk" }
  ],
  bottlenecks: [
    { label: "Manual handoffs between sales and delivery", description: "Context is lost when opportunities move stages" },
    { label: "No standard escalation trigger", description: "At-risk deals are discovered too late" }
  ],
  recommendations: [
    { title: "Assign stage owners and follow-up SLAs", rationale: "Clear ownership reduces stalled handoffs", expectedOutcome: "Faster response times" },
    { title: "Create a weekly pipeline risk review", rationale: "Leadership needs a consistent view of stuck deals", expectedOutcome: "Earlier intervention" }
  ],
  risks: ["Adoption may lag without executive sponsorship"],
  assumptions: ["Sales managers will review pipeline health weekly"],
  businessCase: {
    roi: { estimatedUpside: 175000, estimatedCostOfDelay: 25000, timeHorizonMonths: 6 },
    costOfInaction: { estimatedCost: 90000, timeHorizonMonths: 6, executiveSummary: "Continued delay is expected to leave revenue leakage unresolved." }
  }
};

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

  it("creates non-placeholder executive report sections from reviewed analysis content", () => {
    const sections = buildExecutiveReportSections({}, reviewedAnalysisInput);

    expect(sections.map((section) => section.title)).toEqual([
      "Executive summary",
      "Current state / observed situation",
      "Key constraints",
      "Operational bottlenecks",
      "Strategic recommendations",
      "Risks and assumptions",
      "Cost of inaction narrative",
      "Recommended next steps",
      "Implementation roadmap summary"
    ]);
    expect(sections.every((section) => section.body.length > 30)).toBe(true);
    expect(sections.map((section) => section.body).join("\n")).toContain("Follow-up ownership is inconsistent");
    expect(sections.map((section) => section.body).join("\n")).toContain("Assign stage owners");
    expect(sections.map((section) => section.body).join("\n")).not.toMatch(/Review and refine this section before final approval/i);
  });

  it("normalizes AI placeholder or parse-failure output into useful fallback report content", () => {
    const sections = buildExecutiveReportSections({
      executiveSummary: "Review and refine this section before final approval.",
      strategicRecommendations: "",
      recommendedNextSteps: []
    }, reviewedAnalysisInput);

    const executiveSummary = sections.find((section) => section.title === "Executive summary")?.body ?? "";
    const recommendations = sections.find((section) => section.title === "Strategic recommendations")?.body ?? "";
    expect(executiveSummary).toContain("Follow-up ownership is inconsistent");
    expect(recommendations).toContain("Assign stage owners and follow-up SLAs");
    expect(sections.map((section) => section.body).join("\n")).not.toMatch(/Review and refine/i);
  });

  it("report detail rendering preserves populated sections instead of showing generic placeholders", () => {
    const sections = readableSections(buildExecutiveReportSections({}, reviewedAnalysisInput));

    expect(sections.find((section) => section.title === "Cost of inaction narrative")?.body).toContain("Continued delay");
    expect(sections.find((section) => section.title === "Recommended next steps")?.body).toContain("Assign an owner");
    expect(sections.map((section) => section.body).join("\n")).not.toMatch(/Objective to review|Time horizon to confirm|Review and refine/i);
  });

  it("derives roadmap phases and proposal sections from analysis, constraints, recommendations, and opportunity context", () => {
    const roadmap = buildRoadmapFallback(reviewedAnalysisInput);
    const proposal = buildProposalFallback(reviewedAnalysisInput, { name: "Revenue operations modernization", company: { name: "Acme Co" } }, { summary: "Start with ownership and visibility improvements." });

    expect(roadmap[0].objective).toContain("Assign stage owners");
    expect(roadmap[0].dependencies.join("\n")).toContain("No single accountable owner");
    expect(proposal.clientContext).toContain("Acme Co");
    expect(proposal.recommendedSolution).toContain("Assign stage owners");
    expect(Object.values(proposal).join("\n")).not.toMatch(/Review and refine before sending/i);
  });
});
