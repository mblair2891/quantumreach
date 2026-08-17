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

export type SubscriberSetupFacts = {
  profileComplete: boolean;
  domainVerified: boolean;
  mailboxReady: boolean;
};

export type SubscriberSetupStep = { key: string; label: string; done: boolean; value: string };

export function subscriberSetupSteps(input: SubscriberSetupFacts): SubscriberSetupStep[] {
  return [
    {
      key: "profile",
      label: "Business profile",
      done: input.profileComplete,
      value: input.profileComplete ? "Complete" : "Needs your details",
    },
    {
      key: "domain",
      label: "Sending domain",
      done: input.domainVerified,
      value: input.domainVerified ? "Verified" : "Action needed from you",
    },
    {
      key: "mailbox",
      label: "Mailbox",
      done: input.mailboxReady,
      value: input.mailboxReady ? "Created" : "Waiting on you",
    },
  ];
}

/** Business profile + verified domain + mailbox. Gates dashboard setup vs guided journey. */
export function isRequiredSetupComplete(input: SubscriberSetupFacts) {
  return subscriberSetupSteps(input).every((step) => step.done);
}

export function subscriberSetupFactsFromRecords(input: {
  profileComplete: boolean;
  domains: Array<{ sesIdentity?: { verificationStatus?: string | null; dkimStatus?: string | null } | null }>;
  mailboxCount: number;
}): SubscriberSetupFacts {
  const domainVerified = input.domains.some((domain) => {
    const ses = (domain.sesIdentity?.verificationStatus ?? "").toUpperCase();
    const dkim = (domain.sesIdentity?.dkimStatus ?? "").toUpperCase();
    return (ses === "VERIFIED" || ses === "SUCCESS") && (dkim === "VERIFIED" || dkim === "SUCCESS");
  });
  return {
    profileComplete: input.profileComplete,
    domainVerified,
    mailboxReady: input.mailboxCount > 0,
  };
}

export function displaySubscriberDomainStatus(input: {
  verificationStatus?: string | null;
  dkimStatus?: string | null;
  dnsPending?: boolean;
  dnsFailed?: boolean;
  warmupStatus?: string | null;
}) {
  const ses = (input.verificationStatus ?? "").toUpperCase();
  const dkim = (input.dkimStatus ?? "").toUpperCase();
  const sesOk = ses === "VERIFIED" || ses === "SUCCESS";
  const dkimOk = dkim === "VERIFIED" || dkim === "SUCCESS";
  if (input.dnsFailed && !sesOk) return { label: "Failed", detail: "DNS does not match yet. Update the records and verify again." };
  if (sesOk && dkimOk) {
    const warmup = (input.warmupStatus ?? "").toUpperCase();
    if (warmup === "COMPLETED" || warmup === "ACTIVE") return { label: "Verified", detail: "Ready for warmup and sending setup." };
    if (warmup === "WARMING" || warmup === "SCHEDULED") return { label: "Verified", detail: "Warmup is in progress." };
    return { label: "Verified", detail: "DNS and sending identity are confirmed." };
  }
  if (sesOk && !dkimOk) return { label: "Verifying", detail: "Domain identity is confirmed. DKIM is still catching up." };
  if (input.dnsPending) return { label: "Pending DNS", detail: "Publish the records below, then verify." };
  return { label: "Action needed from you", detail: "Connect DNS, then tap Verify DNS." };
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
