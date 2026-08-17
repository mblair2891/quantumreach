export type SubscriberLifecycleStage =
  | "ACCOUNT_CREATED" | "JOIN_PROFILE_REQUIRED" | "OFFER_SELECTED"
  | "INFRASTRUCTURE_REQUIRED" | "PRIORITY_SELECTED" | "AWAITING_FINANCIAL_CLEARANCE"
  | "FINANCIALLY_CLEARED" | "PROVISIONING" | "ONBOARDING_REQUIRED"
  | "DASHBOARD_ACTIVE" | "FAILED" | "CANCELED";

export type SubscriberLifecycleSnapshot = {
  stage: SubscriberLifecycleStage;
  completed: string[];
  blockingCondition: string | null;
  retryable: boolean;
  nextAction: string;
  route: string;
  dashboardReady: boolean;
};

type LifecycleFacts = {
  profileComplete?: boolean;
  order?: { status: string; paymentStatus: string } | null;
  infrastructure?: { status: string; selectedProductKey?: string | null; priority?: string | null } | null;
  workspaceReady?: boolean;
  membershipReady?: boolean;
  subscriptionReady?: boolean;
  entitlementsReady?: boolean;
  onboardingComplete?: boolean;
};

/** Resolves the canonical acquisition stage from persisted source-of-truth records. */
export function resolveSubscriberLifecycle(facts: LifecycleFacts): SubscriberLifecycleSnapshot {
  const completed = ["account"];
  if (!facts.profileComplete) return snapshot("JOIN_PROFILE_REQUIRED", completed, "A few details are still needed to complete your workspace.", false, "Finish your workspace setup", "/join");
  completed.push("profile");
  if (!facts.order) return snapshot("OFFER_SELECTED", completed, null, false, "Select the core offer", "/join");
  completed.push("offer", "order");
  if (!facts.infrastructure?.selectedProductKey) return snapshot("INFRASTRUCTURE_REQUIRED", completed, null, false, "Choose test-safe infrastructure", "/setup/infrastructure");
  completed.push("infrastructure");
  if (!facts.infrastructure.priority) return snapshot("PRIORITY_SELECTED", completed, null, false, "Choose setup priority", "/setup/priority");
  completed.push("priority");
  if (["CANCELED", "REFUNDED"].includes(facts.order.status)) return snapshot("CANCELED", completed, "This order is no longer active.", false, "Contact support", "/setup/status");
  if (facts.order.status === "FAILED" || facts.infrastructure.status === "FAILED") return snapshot("FAILED", completed, "Something went wrong during workspace setup. Contact support if this continues.", true, "Contact support", "/setup/status");
  if (facts.order.paymentStatus !== "PAID") return snapshot("AWAITING_FINANCIAL_CLEARANCE", completed, "We're confirming your payment.", false, "Check your payment status", "/setup/status");
  completed.push("financial-clearance");
  if (!(facts.workspaceReady && facts.membershipReady && facts.subscriptionReady && facts.entitlementsReady)) return snapshot("PROVISIONING", completed, "We're finishing your workspace.", true, "Refresh status", "/setup/status");
  completed.push("workspace", "membership", "subscription", "entitlements");
  if (!facts.onboardingComplete) return snapshot("ONBOARDING_REQUIRED", completed, null, false, "Finish your workspace setup", "/dashboard/onboarding", true);
  completed.push("onboarding");
  return snapshot("DASHBOARD_ACTIVE", completed, null, false, "Open dashboard", "/dashboard", true);
}

function snapshot(stage: SubscriberLifecycleStage, completed: string[], blockingCondition: string | null, retryable: boolean, nextAction: string, route: string, dashboardReady = false): SubscriberLifecycleSnapshot {
  return { stage, completed, blockingCondition, retryable, nextAction, route, dashboardReady };
}
