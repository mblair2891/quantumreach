import { describe, expect, it } from "vitest";
import { GUIDED_SCENARIO_ID, resolveNextBestAction, type JourneySignals } from "@/lib/customer-journey/guided";

const complete: JourneySignals = {
  profileComplete: true, prospectCount: 1, researchCount: 1, qualifiedCount: 1,
  outreachDraftCount: 1, activeOutreachCount: 1, replyCount: 1,
  scheduledMeetingCount: 1, completedMeetingCount: 1, analysisCount: 1,
  proposalCount: 1, sharedProposalCount: 1, contractCount: 1,
  executedContractCount: 1, wonCount: 1, clientCount: 1, projectCount: 1,
  completedDeliverableCount: 1,
};

describe("customer journey orchestration", () => {
  it("selects the earliest missing persisted prerequisite", () => {
    expect(resolveNextBestAction({ ...complete, researchCount: 0, proposalCount: 0 }).title).toBe("Research your prospect");
  });

  it("does not move backward when all earlier signals remain complete", () => {
    expect(resolveNextBestAction({ ...complete, completedDeliverableCount: 0 }).title).toBe("Complete the first deliverable");
  });

  it("routes a new workspace through profile and prospect creation", () => {
    expect(resolveNextBestAction({ ...complete, profileComplete: false }).href).toBe("/dashboard/onboarding");
    expect(resolveNextBestAction({ ...complete, prospectCount: 0 }).title).toBe("Add your first prospect");
  });

  it("uses the single documented simulation scenario identifier", () => {
    expect(GUIDED_SCENARIO_ID).toBe("SUMMIT_DENTAL_GUIDED_JOURNEY");
  });
});
