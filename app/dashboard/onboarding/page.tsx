import { redirect } from "next/navigation";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { prisma } from "@/lib/db/prisma";
import { readJoinProfile } from "@/lib/customer-journey/profile";
import { displayPlanName, displaySendingSetup } from "@/lib/customer-journey/subscriber-copy";
import { COMMON_TIMEZONES, DEFAULT_CHECKOUT_TIMEZONE, normalizeCheckoutTimezone } from "@/lib/customer-journey/timezones";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

async function completeWorkspaceSetup(form: FormData) {
  "use server";
  const { user, workspace } = await requireSubscriberWorkspaceAccess();
  const businessName = String(form.get("businessName") ?? "").trim();
  const businessType = String(form.get("businessType") ?? "").trim();
  const timezone = normalizeCheckoutTimezone(String(form.get("timezone") ?? ""));
  const country = String(form.get("country") ?? "US").trim().toUpperCase().slice(0, 2);
  if (businessName.length < 2) throw new Error("Enter your business name.");
  if (businessType.length < 2) throw new Error("Tell us what you do.");
  if (country.length !== 2) throw new Error("Enter a two-letter country code.");

  const subscriber = await prisma.saasSubscriberProfile.findUniqueOrThrow({ where: { userId: user.id } });
  const progress =
    subscriber.onboardingProgress && typeof subscriber.onboardingProgress === "object" && !Array.isArray(subscriber.onboardingProgress)
      ? (subscriber.onboardingProgress as Record<string, unknown>)
      : {};
  const existing = readJoinProfile(progress);
  const joinProfile = {
    firstName: user.firstName ?? existing?.firstName ?? "",
    lastName: user.lastName ?? existing?.lastName ?? "",
    businessName,
    businessType,
    timezone,
    country,
    intendedUse: existing?.intendedUse || "Operate my agency workspace with Quantum Reach.",
    agreementAccepted: "on" as const,
  };

  const settings =
    workspace.settings && typeof workspace.settings === "object" && !Array.isArray(workspace.settings)
      ? (workspace.settings as Record<string, unknown>)
      : {};

  await prisma.$transaction([
    prisma.saasSubscriberProfile.update({
      where: { userId: user.id },
      data: {
        onboardingProgress: {
          ...progress,
          joinProfile,
          joinProfileComplete: true,
          onboardingComplete: true,
          completedAt: new Date().toISOString(),
        },
      },
    }),
    prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        name: businessName,
        settings: { ...settings, timezone, onboardingComplete: true },
      },
    }),
  ]);
  redirect("/dashboard");
}

export default async function Page() {
  const { user, workspace } = await requireSubscriberWorkspaceAccess();
  const subscriber = await prisma.saasSubscriberProfile.findUnique({ where: { userId: user.id } });
  const progress =
    subscriber?.onboardingProgress && typeof subscriber.onboardingProgress === "object" && !Array.isArray(subscriber.onboardingProgress)
      ? (subscriber.onboardingProgress as Record<string, unknown>)
      : {};
  if (progress.onboardingComplete === true) redirect("/dashboard");
  const profile = readJoinProfile(subscriber?.onboardingProgress);
  const subscription = await prisma.saasSubscription.findFirst({
    where: { userId: user.id, workspaceId: workspace.id, status: { in: ["ACTIVE", "TRIALING"] } },
  });
  const infrastructure = await prisma.infrastructureOrder.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });
  const sendingPackageKey =
    infrastructure?.selectedProductKey && infrastructure.selectedProductKey !== subscription?.planKey
      ? infrastructure.selectedProductKey
      : null;
  const catalog = await prisma.commerceProduct.findMany({
    where: { key: { in: [subscription?.planKey, sendingPackageKey].filter((key): key is string => Boolean(key)) } },
    select: { key: true, name: true },
  });
  const names = new Map(catalog.map((product) => [product.key, product.name]));
  const planName = displayPlanName(sendingPackageKey ?? subscription?.planKey, names.get(sendingPackageKey ?? subscription?.planKey ?? ""));
  const sending = displaySendingSetup(infrastructure);
  const defaultBusinessName = profile?.businessName && profile.businessName !== "Business" ? profile.businessName : workspace.name;
  const defaultBusinessType = profile?.businessType && profile.businessType !== "Business" ? profile.businessType : "";
  const defaultTimezone = normalizeCheckoutTimezone(profile?.timezone ?? DEFAULT_CHECKOUT_TIMEZONE);
  const defaultCountry = (profile?.country ?? "US").toUpperCase();

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Your workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
          Finish your setup
        </h1>
        <p className="mt-2 max-w-2xl text-slate-700 dark:text-slate-300">
          Tell us about your business so outreach, proposals, and your workspace name stay accurate. Sending
          infrastructure can continue in the background.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>Payment is complete. You can start using the dashboard after you save these details.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate-600 dark:text-slate-300">Plan</dt>
              <dd className="mt-1 font-semibold text-slate-950 dark:text-slate-50">{planName}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-600 dark:text-slate-300">Sending setup</dt>
              <dd className="mt-1 font-semibold text-slate-950 dark:text-slate-50">{sending.label}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your business</CardTitle>
          <CardDescription>These details belong to you — not your clients.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={completeWorkspaceSetup} className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-slate-800 dark:text-slate-200">
              Business name
              <Input name="businessName" required minLength={2} maxLength={160} defaultValue={defaultBusinessName} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-800 dark:text-slate-200">
              What you do
              <Input
                name="businessType"
                required
                minLength={2}
                maxLength={120}
                defaultValue={defaultBusinessType}
                placeholder="Lead generation, consulting, …"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-800 dark:text-slate-200">
              Timezone
              <select
                name="timezone"
                required
                defaultValue={defaultTimezone}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                {COMMON_TIMEZONES.map((zone) => (
                  <option key={zone.value} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-800 dark:text-slate-200">
              Country
              <Input name="country" required maxLength={2} defaultValue={defaultCountry} />
            </label>
            <button className="mt-2 rounded-xl bg-sky-700 px-6 py-3 font-semibold text-white hover:bg-sky-800 sm:col-span-2">
              Save and open dashboard
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
