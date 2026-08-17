/** Subscriber-facing labels. Never show operator enums or call the agency owner “customer”. */

const PLAN_NAMES: Record<string, string> = {
  QUANTUM_REACH_CORE: "Quantum Reach",
  LAUNCH_SENDER_PACKAGE: "Launch",
  GROWTH_SENDER_PACKAGE: "Growth",
  SCALE_SENDER_PACKAGE: "Scale",
  STANDARD_SETUP: "Standard setup",
  PRIORITY_SETUP: "Priority setup",
};

export function displayPlanName(key?: string | null, catalogName?: string | null) {
  if (catalogName?.trim()) return catalogName.trim();
  if (!key) return "Quantum Reach";
  if (PLAN_NAMES[key]) return PLAN_NAMES[key];
  return key
    .replace(/_PACKAGE$/i, "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function displayPaymentStatus(paymentStatus?: string | null) {
  if (paymentStatus === "PAID") return "Complete";
  if (paymentStatus === "FAILED") return "Needs attention";
  if (!paymentStatus || paymentStatus === "UNPAID") return "Not complete";
  return "In progress";
}

export function displayWorkspaceReady(ready: boolean) {
  return ready ? "Ready" : "Setting up";
}

export function displayYourSetupStatus(onboardingComplete: boolean, workspaceReady: boolean) {
  if (onboardingComplete) return "Complete";
  if (workspaceReady) return "Needs your details";
  return "Almost ready";
}

export function displaySendingSetup(infra?: {
  status?: string | null;
  currentStage?: string | null;
  customerActionRequired?: boolean | null;
} | null) {
  if (!infra) {
    return { label: "Later", hint: "Not required to use the dashboard yet." };
  }
  if (infra.customerActionRequired || infra.status === "WAITING_ON_CUSTOMER") {
    return { label: "Action needed from you", hint: "A few sending details are still needed." };
  }
  if (infra.status === "READY" || infra.status === "COMPLETED") {
    return { label: "Ready", hint: "Sending setup is complete." };
  }
  if (["WAITING_ON_PROVIDER", "IN_PROGRESS", "QUEUED", "PENDING"].includes(infra.status ?? "")) {
    return { label: "In progress", hint: "This can finish in the background." };
  }
  return { label: "Later", hint: "Not required to use the dashboard yet." };
}

export type SubscriberSetupStep = { key: string; label: string; done: boolean; value: string };

export function subscriberSetupSteps(input: {
  paid: boolean;
  workspaceReady: boolean;
  onboardingComplete: boolean;
}): SubscriberSetupStep[] {
  return [
    { key: "payment", label: "Payment", done: input.paid, value: input.paid ? "Complete" : "Not complete" },
    {
      key: "workspace",
      label: "Workspace",
      done: input.workspaceReady,
      value: displayWorkspaceReady(input.workspaceReady),
    },
    {
      key: "setup",
      label: "Your setup",
      done: input.onboardingComplete,
      value: displayYourSetupStatus(input.onboardingComplete, input.workspaceReady),
    },
  ];
}

export function subscriberLifecycleHeadline(stage: string) {
  switch (stage) {
    case "ONBOARDING_REQUIRED":
      return "Finish your workspace setup";
    case "DASHBOARD_ACTIVE":
      return "Your workspace is ready";
    case "AWAITING_FINANCIAL_CLEARANCE":
      return "We're confirming your payment";
    case "PROVISIONING":
      return "We're finishing your workspace";
    case "FAILED":
      return "We need to take another look";
    case "CANCELED":
      return "This order is no longer active";
    default:
      return "Your setup";
  }
}
