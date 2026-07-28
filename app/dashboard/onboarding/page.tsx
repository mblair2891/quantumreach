import { redirect } from "next/navigation";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { prisma } from "@/lib/db/prisma";
import { readJoinProfile } from "@/lib/customer-journey/profile";

async function completeOnboarding() {
  "use server";
  const { user, workspace } = await requireSubscriberWorkspaceAccess();
  const subscriber = await prisma.saasSubscriberProfile.findUniqueOrThrow({ where: { userId: user.id } });
  const progress = subscriber.onboardingProgress && typeof subscriber.onboardingProgress === "object" && !Array.isArray(subscriber.onboardingProgress) ? subscriber.onboardingProgress as Record<string, unknown> : {};
  await prisma.$transaction([
    prisma.saasSubscriberProfile.update({ where: { userId: user.id }, data: { onboardingProgress: { ...progress, onboardingComplete: true, completedAt: new Date().toISOString() } } }),
    prisma.workspace.update({ where: { id: workspace.id }, data: { settings: { timezone: (workspace.settings as Record<string, unknown>)?.timezone ?? "UTC", onboardingComplete: true } } }),
  ]);
  redirect("/dashboard");
}

export default async function Page() {
  const { user, workspace } = await requireSubscriberWorkspaceAccess();
  const subscriber = await prisma.saasSubscriberProfile.findUnique({ where: { userId: user.id } });
  const progress = subscriber?.onboardingProgress && typeof subscriber.onboardingProgress === "object" && !Array.isArray(subscriber.onboardingProgress) ? subscriber.onboardingProgress as Record<string, unknown> : {};
  if (progress.onboardingComplete === true) redirect("/dashboard");
  const profile = readJoinProfile(subscriber?.onboardingProgress);
  const subscription = await prisma.saasSubscription.findFirst({ where: { userId: user.id, workspaceId: workspace.id, status: { in: ["ACTIVE", "TRIALING"] } } });
  const entitlements = await prisma.saasSubscriptionItem.count({ where: { workspaceId: workspace.id, status: "ACTIVE" } });
  const infrastructure = await prisma.infrastructureOrder.findFirst({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" } });
  return <main className="mx-auto max-w-3xl p-6 sm:py-14"><p className="text-sm font-bold tracking-widest text-indigo-600">SUBSCRIBER ONBOARDING</p><h1 className="mt-3 text-4xl font-semibold">Welcome to {workspace.name}</h1><p className="mt-3 text-slate-600">Review the workspace created from your acquisition profile. Provider setup can continue separately.</p><dl className="mt-8 grid gap-4 rounded-2xl border bg-white p-6 sm:grid-cols-2"><Summary label="Business" value={profile?.businessName ?? workspace.name}/><Summary label="Service" value={profile?.businessType ?? "Not provided"}/><Summary label="Plan" value={subscription?.planKey ?? "Pending"}/><Summary label="Entitlements" value={`${entitlements} active product assignment(s)`}/><Summary label="Infrastructure" value={infrastructure ? `${infrastructure.status.replaceAll("_", " ")} — ${infrastructure.currentStage}` : "Deferred"}/><Summary label="Workspace role" value="Subscriber workspace owner"/></dl><form action={completeOnboarding} className="mt-8 rounded-2xl border bg-slate-50 p-6"><label className="flex gap-3"><input name="confirmed" type="checkbox" required/><span>I confirm this workspace belongs to my business and I am ready to continue.</span></label><button className="mt-5 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white">Complete onboarding and open dashboard</button></form></main>;
}

function Summary({ label, value }: { label: string; value: string }) { return <div><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>; }
