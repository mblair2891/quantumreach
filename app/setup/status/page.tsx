import Link from "next/link";
import { requireUserProfile } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { resolveSubscriberLifecycle } from "@/lib/customer-journey/lifecycle";
import { readJoinProfile } from "@/lib/customer-journey/profile";
import { FunnelShell } from "@/components/funnel/shell";

export const dynamic = "force-dynamic";

export default async function SetupStatus() {
  const user = await requireUserProfile();
  const setup = await prisma.infrastructureOrder.findFirst({ where: { order: { userId: user.id } }, include: { tasks: true, order: true }, orderBy: { createdAt: "desc" } });
  const subscriber = await prisma.saasSubscriberProfile.findUnique({ where: { userId: user.id } });
  const membership = setup?.workspaceId ? await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: setup.workspaceId, userId: user.id } } }) : null;
  const subscription = setup?.workspaceId ? await prisma.saasSubscription.findFirst({ where: { userId: user.id, workspaceId: setup.workspaceId, status: { in: ["ACTIVE", "TRIALING"] } } }) : null;
  const entitlementCount = setup?.workspaceId ? await prisma.saasSubscriptionItem.count({ where: { workspaceId: setup.workspaceId, status: "ACTIVE" } }) : 0;
  const progress = subscriber?.onboardingProgress && typeof subscriber.onboardingProgress === "object" && !Array.isArray(subscriber.onboardingProgress) ? subscriber.onboardingProgress as Record<string, unknown> : {};
  const lifecycle = resolveSubscriberLifecycle({ profileComplete: Boolean(readJoinProfile(subscriber?.onboardingProgress)), order: setup?.order, infrastructure: setup, workspaceReady: Boolean(setup?.workspaceId), membershipReady: membership?.status === "ACTIVE", subscriptionReady: Boolean(subscription), entitlementsReady: entitlementCount > 0, onboardingComplete: progress.onboardingComplete === true });
  const rows = [
    ["Order", setup?.order.status ?? "Not started"],
    ["Financial clearance", setup ? `${setup.order.paymentStatus} · ${setup.order.paymentMethod}` : "Not started"],
    ["Workspace", setup?.workspaceId ? "Created" : "Pending"],
    ["Membership", membership?.status === "ACTIVE" ? `Active · ${membership.roleKey}` : "Pending"],
    ["Subscription", subscription ? `${subscription.status} · ${subscription.planKey}` : "Pending"],
    ["Entitlements", entitlementCount ? `${entitlementCount} active product assignment(s)` : "Pending"],
    ["Infrastructure", setup ? `${setup.status.replaceAll("_", " ")} · ${setup.currentStage}` : "Not selected"],
    ["Onboarding", progress.onboardingComplete === true ? "Complete" : setup?.workspaceId ? "Required" : "Pending"],
    ["Dashboard", lifecycle.dashboardReady ? "Available" : "Not ready"],
  ];
  return <FunnelShell><main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16"><p className="funnel-eyebrow">Subscriber lifecycle</p><h1 className="funnel-title mt-3 text-4xl font-semibold">Your setup status</h1><p className="funnel-copy mt-3">Current stage: <strong>{lifecycle.stage.replaceAll("_", " ")}</strong></p><div className="mt-8 overflow-hidden rounded-2xl border bg-white">{rows.map(([label, value]) => <div className="flex justify-between gap-5 border-b px-5 py-4 last:border-0" key={label}><span className="text-slate-600">{label}</span><strong className="text-right">{value}</strong></div>)}</div>{lifecycle.blockingCondition && <p className="mt-6 rounded-xl bg-amber-50 p-4 text-amber-900">{lifecycle.blockingCondition}</p>}<section className="mt-6 funnel-card p-6"><h2 className="font-semibold">Next action</h2><p className="mt-2 text-slate-600">{lifecycle.nextAction}</p><div className="mt-5 flex flex-wrap gap-3"><Link className="funnel-primary" href={lifecycle.route}>{lifecycle.dashboardReady ? "Continue" : "Check next step"}</Link><Link className="funnel-secondary" href="/setup/status">Refresh status</Link><a className="funnel-secondary" href="mailto:support@quantumreach.ai">Contact support</a></div></section><p className="mt-5 text-sm text-slate-500">Managed infrastructure is tracked independently and may remain deferred without blocking an otherwise active dashboard.</p></main></FunnelShell>;
}
