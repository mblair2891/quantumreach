import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { prisma } from "@/lib/db/prisma";
import { readJoinProfile } from "@/lib/customer-journey/profile";
import { displayPlanName, isRequiredSetupComplete, subscriberSetupSteps } from "@/lib/customer-journey/subscriber-copy";
import { loadSubscriberSetupFacts, markRequiredSetupComplete } from "@/lib/customer-journey/setup-facts";
import { COMMON_TIMEZONES, DEFAULT_CHECKOUT_TIMEZONE, normalizeCheckoutTimezone } from "@/lib/customer-journey/timezones";
import {
  displayCoreDomainMode,
  getWorkspaceCoreDomain,
  isCoreDomainAddonPriced,
  saveWorkspaceCoreDomain,
} from "@/lib/workspaces/core-domain";
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
        },
      },
    }),
    prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        name: businessName,
        settings: { ...settings, timezone },
      },
    }),
  ]);
  redirect("/dashboard/onboarding");
}

async function saveCoreDomainChoice(form: FormData) {
  "use server";
  const { workspace } = await requireSubscriberWorkspaceAccess();
  const choice = String(form.get("coreDomainChoice") ?? "");
  if (choice === "byo") {
    await saveWorkspaceCoreDomain({
      workspaceId: workspace.id,
      mode: "BYO",
      domainName: String(form.get("coreDomainName") ?? ""),
    });
  } else if (choice === "addon") {
    await saveWorkspaceCoreDomain({ workspaceId: workspace.id, mode: "MANAGED_ADDON" });
  } else {
    await saveWorkspaceCoreDomain({ workspaceId: workspace.id, mode: "NONE" });
  }
  redirect("/dashboard/onboarding");
}

export default async function Page() {
  const { user, workspace } = await requireSubscriberWorkspaceAccess();
  const subscriber = await prisma.saasSubscriberProfile.findUnique({ where: { userId: user.id } });
  const setupFacts = await loadSubscriberSetupFacts(user.id, workspace.id);
  if (isRequiredSetupComplete(setupFacts)) {
    await markRequiredSetupComplete(user.id, workspace.id);
    redirect("/dashboard");
  }
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
  const steps = subscriberSetupSteps(setupFacts);
  const defaultBusinessName = profile?.businessName && profile.businessName !== "Business" ? profile.businessName : workspace.name;
  const defaultBusinessType = profile?.businessType && profile.businessType !== "Business" ? profile.businessType : "";
  const defaultTimezone = normalizeCheckoutTimezone(profile?.timezone ?? DEFAULT_CHECKOUT_TIMEZONE);
  const defaultCountry = (profile?.country ?? "US").toUpperCase();
  const coreDomain = await getWorkspaceCoreDomain(workspace.id);
  const addonPriced = isCoreDomainAddonPriced();

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Your workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
          Finish your setup
        </h1>
        <p className="mt-2 max-w-2xl text-slate-700 dark:text-slate-300">
          Three required steps: your business profile, a sending domain for outreach, and a mailbox so warmup can start.
          Your main business domain is optional and separate.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Setup progress</CardTitle>
          <CardDescription>Plan: {planName}. Warmup can continue after these steps.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {steps.map((step) => (
              <li key={step.key} className="flex justify-between gap-4 text-slate-800 dark:text-slate-200">
                <span>{step.label}</span>
                <strong className="text-slate-950 dark:text-slate-50">{step.value}</strong>
              </li>
            ))}
          </ul>
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
              Save business profile
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Main business domain</CardTitle>
          <CardDescription>
            Do you already have a main business domain — the one for your website and normal admin/support email? This is
            not used for outreach sending.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {coreDomain.mode !== "NONE" ? (
            <p className="text-sm text-slate-800 dark:text-slate-200">
              {displayCoreDomainMode(coreDomain.mode)}
              {coreDomain.domainName ? (
                <>
                  : <strong>{coreDomain.domainName}</strong>
                </>
              ) : null}
            </p>
          ) : null}
          <form action={saveCoreDomainChoice} className="grid gap-3">
            <input type="hidden" name="coreDomainChoice" value="byo" />
            <label className="grid gap-1 text-sm font-medium text-slate-800 dark:text-slate-200">
              Yes — save it as a reference
              <Input name="coreDomainName" placeholder="example.com" defaultValue={coreDomain.mode === "BYO" ? coreDomain.domainName ?? "" : ""} />
            </label>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              We won’t transfer or change this domain. Sending packages use separate sending domains.
            </p>
            <button className="rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white hover:bg-sky-800">
              Save main business domain
            </button>
          </form>
          <div className="flex flex-wrap gap-3">
            <form action={saveCoreDomainChoice}>
              <input type="hidden" name="coreDomainChoice" value="skip" />
              <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Continue with sending only
              </button>
            </form>
            <form action={saveCoreDomainChoice}>
              <input type="hidden" name="coreDomainChoice" value="addon" />
              <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                {addonPriced ? "Add Core brand domain (monthly)" : "Core brand domain add-on — coming soon"}
              </button>
            </form>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Core brand domain (optional) — website & admin/support identity. It is not bundled into Launch, Growth, or
            Scale sending packages.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sending domains & outreach mailboxes</CardTitle>
          <CardDescription>
            {setupFacts.domainVerified
              ? "Your sending domain is verified. You can create an outreach mailbox next."
              : "These domains are for outreach / bulk sending, not your main company website domain. Add a sending domain you control, publish the DNS records, then verify."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link className="inline-flex rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white hover:bg-sky-800" href="/dashboard/sending/domains">
            {setupFacts.domainVerified ? "View sending domain" : "Add or verify sending domain"}
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mailbox</CardTitle>
          <CardDescription>
            {setupFacts.mailboxReady
              ? "A sending address exists. Warmup can start."
              : setupFacts.domainVerified
                ? "Create a sending address on your verified domain."
                : "Verify a domain first, then create a mailbox."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            className="inline-flex rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white hover:bg-sky-800"
            href="/dashboard/sending/mailboxes"
          >
            {setupFacts.mailboxReady ? "View mailboxes" : "Create mailbox"}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
