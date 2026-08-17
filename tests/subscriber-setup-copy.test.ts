import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  displayPaymentStatus,
  displayPlanName,
  displaySendingSetup,
  displaySubscriberDomainStatus,
  displayYourSetupStatus,
  isRequiredSetupComplete,
  subscriberLifecycleHeadline,
  subscriberSetupSteps,
} from "@/lib/customer-journey/subscriber-copy";
import { resolveSubscriberLifecycle } from "@/lib/customer-journey/lifecycle";
import { resolveNextBestAction, type JourneySignals } from "@/lib/customer-journey/guided";

const source = (path: string) => readFileSync(path, "utf8");

const completeJourney: JourneySignals = {
  profileComplete: true,
  prospectCount: 1,
  researchCount: 1,
  qualifiedCount: 1,
  outreachDraftCount: 1,
  activeOutreachCount: 1,
  replyCount: 1,
  scheduledMeetingCount: 1,
  completedMeetingCount: 1,
  analysisCount: 1,
  proposalCount: 1,
  sharedProposalCount: 1,
  contractCount: 1,
  executedContractCount: 1,
  wonCount: 1,
  clientCount: 1,
  projectCount: 1,
  completedDeliverableCount: 1,
};

describe("subscriber-facing setup copy", () => {
  it("maps commerce keys and payment states to plain language", () => {
    expect(displayPlanName("QUANTUM_REACH_CORE")).toBe("Quantum Reach");
    expect(displayPlanName("GROWTH_SENDER_PACKAGE")).toBe("Growth");
    expect(displayPlanName("GROWTH_SENDER_PACKAGE", "Growth Sender")).toBe("Growth Sender");
    expect(displayPaymentStatus("PAID")).toBe("Complete");
    expect(displayPaymentStatus("UNPAID")).toBe("Not complete");
    expect(displayYourSetupStatus(false, true)).toBe("Needs your details");
    expect(displaySendingSetup({ status: "WAITING_ON_CUSTOMER", customerActionRequired: true }).label).toBe(
      "Action needed from you",
    );
    expect(subscriberLifecycleHeadline("ONBOARDING_REQUIRED")).toBe("Finish your workspace setup");
    expect(subscriberSetupSteps({ profileComplete: true, domainVerified: false, mailboxReady: false }).map((step) => step.value)).toEqual([
      "Complete",
      "Action needed from you",
      "Waiting on you",
    ]);
    expect(isRequiredSetupComplete({ profileComplete: true, domainVerified: false, mailboxReady: false })).toBe(false);
    expect(isRequiredSetupComplete({ profileComplete: true, domainVerified: true, mailboxReady: true })).toBe(true);
    expect(displaySubscriberDomainStatus({ verificationStatus: "PENDING", dnsPending: true }).label).toBe("Pending DNS");
    expect(displaySubscriberDomainStatus({ verificationStatus: "VERIFIED", dkimStatus: "VERIFIED" }).label).toBe("Verified");
  });

  it("sends a paid workspace to onboarding with finish-setup language", () => {
    const lifecycle = resolveSubscriberLifecycle({
      profileComplete: true,
      order: { status: "FULFILLED", paymentStatus: "PAID" },
      infrastructure: { status: "WAITING_ON_PROVIDER", selectedProductKey: "LAUNCH_SENDER_PACKAGE", priority: "STANDARD" },
      workspaceReady: true,
      membershipReady: true,
      subscriptionReady: true,
      entitlementsReady: true,
      onboardingComplete: false,
    });
    expect(lifecycle).toMatchObject({
      stage: "ONBOARDING_REQUIRED",
      nextAction: "Finish your workspace setup",
      route: "/dashboard/onboarding",
    });
    expect(resolveNextBestAction({ ...completeJourney, profileComplete: false })).toMatchObject({
      title: "Complete your setup",
      href: "/dashboard/onboarding",
    });
  });

  it("keeps subscriber UI free of operator jargon and customer-as-subscriber wording", () => {
    const status = source("app/setup/status/page.tsx");
    const onboarding = source("app/dashboard/onboarding/page.tsx");
    const banner = source("components/dashboard/setup-progress-card.tsx");
    const dashboard = source("app/dashboard/page.tsx");
    const nextBest = source("components/dashboard/saas-dashboard.tsx");
    const surfaces = [status, onboarding, banner, dashboard, nextBest].join("\n");

    expect(status).toContain("Continue setup");
    expect(status).toContain("/dashboard/onboarding");
    expect(status).not.toContain("WORKSPACE_OWNER");
    expect(status).not.toContain("QUANTUM_REACH_CORE");
    expect(status).not.toContain("FULFILLED");
    expect(status).not.toContain("Entitlements");
    expect(status).not.toContain("active product assignment");
    expect(onboarding).toContain("Save business profile");
    expect(onboarding).toContain("Business name");
    expect(onboarding).toContain("text-slate-950");
    expect(onboarding).toContain("dark:text-slate-50");
    expect(onboarding).not.toContain("WORKSPACE_OWNER");
    expect(onboarding).not.toContain("bg-white p-6");
    expect(banner).toContain("Finish your setup");
    expect(banner).toContain("A few details are still needed to complete your workspace.");
    expect(banner).toContain("Continue setup");
    expect(banner).toContain("requiredSetupComplete");
    expect(banner).not.toContain("Waiting on customer");
    expect(banner).not.toContain("View setup status");
    expect(dashboard).toContain("isRequiredSetupComplete");
    expect(dashboard).toContain("requiredSetupComplete");
    expect(nextBest).toContain("Continue journey");
    expect(nextBest).toContain("requiredSetupComplete && journey");
    expect(nextBest).toContain("guided journey unlocks after you finish setup");
    expect(nextBest).not.toContain("Continue setup");
    expect(surfaces.toLowerCase()).not.toContain("waiting on customer");
    expect(surfaces).not.toContain("WAITING ON CUSTOMER");
  });

  it("gates the 3-step setup banner and 18-step journey so they never share a screen", () => {
    const dashboard = source("app/dashboard/page.tsx");
    const banner = source("components/dashboard/setup-progress-card.tsx");
    const nextBest = source("components/dashboard/saas-dashboard.tsx");
    expect(dashboard).toContain("requiredSetupComplete ? await getGuidedJourney");
    expect(dashboard).toContain("requiredSetupComplete={requiredSetupComplete}");
    expect(banner).toContain("state.requiredSetupComplete");
    expect(banner).toContain("Continue setup");
    expect(banner).not.toContain("journey.total");
    expect(nextBest).toContain("Continue journey");
    expect(nextBest).toContain("journey.completed}/{journey.total}");
    expect(nextBest.indexOf("requiredSetupComplete && journey")).toBeLessThan(nextBest.indexOf("Continue journey"));
  });
});
