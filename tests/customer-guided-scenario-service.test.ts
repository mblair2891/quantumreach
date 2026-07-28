import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { transitionOrder } from "@/lib/customer-journey/guided";

const source = readFileSync("lib/customer-journey/guided.ts", "utf8");

describe("Summit Dental guided scenario service", () => {
  it("defines the complete ordered lifecycle", () => expect(transitionOrder).toEqual([
    "RESEARCH", "QUALIFIED", "OUTREACH_DRAFT", "OUTREACH_APPROVED", "SEND_SIMULATED", "REPLY_SIMULATED",
    "MEETING_SCHEDULED", "MEETING_COMPLETED", "ANALYSIS_CREATED", "ANALYSIS_APPROVED", "PROPOSAL_CREATED",
    "PROPOSAL_SHARED", "PROPOSAL_ACCEPTED", "CONTRACT_CREATED", "AGREEMENT_COMPLETED", "OPPORTUNITY_WON",
    "CLIENT_CONVERTED", "ONBOARDING_CREATED", "DELIVERY_PLAN_CREATED", "DELIVERABLE_CREATED", "DELIVERABLE_APPROVED"
  ]));

  for (const requirement of [
    "researchRun.create", "score: 78", "outreachCampaign.create", "Approved for guided simulation only",
    "GUIDED_SIMULATION_NO_PROVIDER_CALL", "SIMULATED_OUTREACH_REPLY", "callSession.create", "SIMULATED DISCOVERY CALL",
    "transcript.create", "analysisRecord.create", "status: \"REVIEWED\"", "proposal.create", "PROPOSAL_SHARED",
    "PROPOSAL_ACCEPTED", "contract.create", "Not a legally binding external e-signature", "status: \"WON\"",
    "convertWonOpportunityToClient", "[ONBOARDING", "projectMilestone.create", "executiveReport.create",
    "Client approved first deliverable", "resetExampleJourney"
  ]) it(`persists ${requirement}`, () => expect(source).toContain(requirement));

  it("does not invoke live provider services", () => {
    expect(source).not.toMatch(/sendEmail|sendRawEmail|createZoomMeeting|stripe\.|generateStructured/);
    expect(source).toContain("providerCalled: false");
  });

  it("scopes scenario context and reset to the authorized workspace", () => {
    expect(source).toContain("requireWorkspaceAccess(workspaceId)");
    expect(source).toContain("id: created.relatedId, workspaceId");
    expect(source).toContain("where: { workspaceId, opportunityId: c.opportunity.id }");
  });

  it("does not mutate infrastructure usage or Stripe payment records", () => {
    expect(source).not.toContain("workspaceInfrastructureUsage.update");
    expect(source).not.toContain("stripePaymentRecord.update");
  });
});
