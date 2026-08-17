import Link from "next/link";
import { requireUserProfile } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { resolveSubscriberLifecycle } from "@/lib/customer-journey/lifecycle";
import { readJoinProfile } from "@/lib/customer-journey/profile";
import {
  displaySendingSetup,
  isRequiredSetupComplete,
  subscriberLifecycleHeadline,
  subscriberSetupSteps,
} from "@/lib/customer-journey/subscriber-copy";
import { loadSubscriberSetupFacts } from "@/lib/customer-journey/setup-facts";
import { FunnelShell } from "@/components/funnel/shell";
import { isSimulatedPaymentEnvironment } from "@/lib/simulated-payment/environment";

export const dynamic = "force-dynamic";

export default async function SetupStatus({ searchParams }: { searchParams?: { testPayment?: string } }) {
  const user = await requireUserProfile();
  const setup = await prisma.infrastructureOrder.findFirst({
    where: { order: { userId: user.id } },
    include: { tasks: true, order: true },
    orderBy: { createdAt: "desc" },
  });
  const subscriber = await prisma.saasSubscriberProfile.findUnique({ where: { userId: user.id } });
  const membership = setup?.workspaceId
    ? await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: setup.workspaceId, userId: user.id } },
      })
    : null;
  const subscription = setup?.workspaceId
    ? await prisma.saasSubscription.findFirst({
        where: { userId: user.id, workspaceId: setup.workspaceId, status: { in: ["ACTIVE", "TRIALING"] } },
      })
    : null;
  const entitlementCount = setup?.workspaceId
    ? await prisma.saasSubscriptionItem.count({ where: { workspaceId: setup.workspaceId, status: "ACTIVE" } })
    : 0;
  const setupFacts = await loadSubscriberSetupFacts(user.id, setup?.workspaceId ?? subscriber?.workspaceId);
  const requiredSetupComplete = isRequiredSetupComplete(setupFacts);
  const lifecycle = resolveSubscriberLifecycle({
    profileComplete: Boolean(readJoinProfile(subscriber?.onboardingProgress)),
    order: setup?.order,
    infrastructure: setup,
    workspaceReady: Boolean(setup?.workspaceId),
    membershipReady: membership?.status === "ACTIVE",
    subscriptionReady: Boolean(subscription),
    entitlementsReady: entitlementCount > 0,
    onboardingComplete: requiredSetupComplete,
  });
  const steps = subscriberSetupSteps(setupFacts);
  const sending = displaySendingSetup(setup);
  const primaryHref = lifecycle.dashboardReady
    ? requiredSetupComplete
      ? "/dashboard"
      : "/dashboard/onboarding"
    : lifecycle.route;
  const primaryLabel = requiredSetupComplete && lifecycle.dashboardReady ? "Open dashboard" : "Continue setup";

  return (
    <FunnelShell>
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="funnel-eyebrow">Your workspace</p>
        <h1 className="funnel-title mt-3 text-4xl font-semibold">{subscriberLifecycleHeadline(lifecycle.stage)}</h1>
        {isSimulatedPaymentEnvironment() && setup?.order.paymentMethod === "SIMULATED_TEST" ? (
          <p className="mt-5 rounded-xl border border-indigo-300 bg-indigo-50 p-4 text-sm font-semibold text-indigo-950">
            {searchParams?.testPayment === "completed" ? "Test payment completed" : "Test payment"} — no real charge was
            made.
          </p>
        ) : null}
        <p className="funnel-copy mt-3">
          {requiredSetupComplete
            ? "You're ready to start working in your workspace. Sending warmup can continue in the background."
            : "Finish the three setup steps: your business profile, a sending domain, and a mailbox."}
        </p>
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {steps.map((step) => (
            <div className="flex justify-between gap-5 border-b border-slate-200 px-5 py-4 last:border-0" key={step.key}>
              <span className="funnel-status-label">{step.label}</span>
              <strong className="funnel-status-value">{step.value}</strong>
            </div>
          ))}
          <div className="flex justify-between gap-5 px-5 py-4">
            <span className="funnel-status-label">Sending setup</span>
            <strong className="funnel-status-value">{sending.label}</strong>
          </div>
        </div>
        {lifecycle.blockingCondition ? (
          <p className="mt-6 rounded-xl bg-amber-50 p-4 text-amber-950">{lifecycle.blockingCondition}</p>
        ) : null}
        <section className="funnel-card mt-6 p-6">
          <h2 className="font-semibold text-slate-950">Next</h2>
          <p className="mt-2 text-slate-700">{lifecycle.nextAction}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="funnel-primary" href={primaryHref}>
              {primaryLabel}
            </Link>
            <Link className="funnel-secondary" href="/setup/status">
              Refresh
            </Link>
            <a className="funnel-secondary" href="mailto:support@quantumreach.ai">
              Contact support
            </a>
          </div>
        </section>
        <p className="mt-5 text-sm text-slate-700">
          {sending.hint} Managed sending infrastructure can continue in the background without blocking your dashboard.
        </p>
      </main>
    </FunnelShell>
  );
}
