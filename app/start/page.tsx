import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { saveDraftSelection, catalogPrice, money } from "@/lib/customer-journey/acquisition-draft";
import { AcquisitionCapture } from "./acquisition";
import { FunnelShell } from "@/components/funnel/shell";
import { FunnelProgress } from "@/components/funnel/progress";
import { getOptionalUserProfile } from "@/lib/auth/rbac";
import { ensureAcquisitionCatalogReady } from "@/lib/sending-infrastructure/operational";
export const dynamic = "force-dynamic";
function metadata(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
async function selectPlan(formData: FormData) {
  "use server";
  await ensureAcquisitionCatalogReady();
  const id = String(formData.get("productId") ?? "");
  const [plan, core] = await Promise.all([
    prisma.commerceProduct.findFirst({ where: { id, category: "SENDING_PACKAGE", active: true } }),
    prisma.commerceProduct.findFirst({ where: { category: "SOFTWARE_CORE", active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (!plan || !core) throw new Error("That subscriber package is no longer available.");
  await saveDraftSelection({ coreProductId: core.id, infrastructureProductId: plan.id, returnRoute: "/setup/confirmation" });
  redirect("/setup/priority");
}
export default async function StartPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await ensureAcquisitionCatalogReady();
  // Only show signed-in messaging when a real Better Auth session is present.
  // Logged-out visitors must always see a clean guest funnel.
  let existing: Awaited<ReturnType<typeof getOptionalUserProfile>> = null;
  try {
    existing = await getOptionalUserProfile();
  } catch {
    existing = null;
  }
  const activeSubscription =
    existing != null
      ? await prisma.saasSubscription.findFirst({
          where: { userId: existing.id, status: { in: ["ACTIVE", "TRIALING"] }, workspaceId: { not: null } },
        })
      : null;
  const products = await prisma.commerceProduct.findMany({
    where: { category: "SENDING_PACKAGE", active: true, key: { in: ["LAUNCH_SENDER_PACKAGE", "GROWTH_SENDER_PACKAGE", "SCALE_SENDER_PACKAGE"] } },
    include: { entitlements: true },
    orderBy: { sortOrder: "asc" },
  });
  return (
    <FunnelShell>
      <AcquisitionCapture params={searchParams} />
      <main className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <FunnelProgress current={1} />
        {searchParams.referral === "captured" ? (
          <p
            role="status"
            className="mb-7 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-medium text-emerald-950"
          >
            Referral saved. Continue choosing your package — your code will be applied at checkout.
          </p>
        ) : null}
        {searchParams.referral === "invalid" ? (
          <p
            role="alert"
            className="mb-7 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-medium text-amber-950"
          >
            That referral link is not valid or is no longer active. You can still continue without a referral.
          </p>
        ) : null}
        {existing && activeSubscription ? (
          <div className="mb-7 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-center text-indigo-950">
            <p>
              You are signed in as <strong>{existing.email}</strong> and already have an active workspace.
            </p>
            <p className="mt-2 flex flex-wrap items-center justify-center gap-4 text-sm font-semibold">
              <a className="underline" href="/dashboard">
                Open your dashboard
              </a>
              <a className="underline" href="/sign-out?next=/start">
                Sign out for a clean guest checkout
              </a>
            </p>
          </div>
        ) : existing ? (
          <div className="mb-7 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-slate-800">
            <p>
              Signed in as <strong>{existing.email}</strong>. Guest checkout still works below with any purchaser email.
            </p>
            <p className="mt-2 text-sm">
              <a className="font-semibold underline" href="/sign-out?next=/start">
                Sign out
              </a>{" "}
              for a fully anonymous session.
            </p>
          </div>
        ) : null}
        <header className="text-center">
          <p className="funnel-eyebrow">Step 1 · Complete platform package</p>
          <h1 className="funnel-title mt-3 text-4xl font-semibold sm:text-5xl">Choose your client-growth operating system.</h1>
          <p className="funnel-copy mx-auto mt-4 max-w-3xl">
            Complete Quantum Reach platform included in every package: CRM, outreach, meetings, analysis, proposals, contracts, client delivery, reporting, and guided next best action.
          </p>
        </header>
        <section className="mt-10 grid gap-6 lg:grid-cols-3">
          {products.map((product) => {
            const m = metadata(product.metadata);
            const e = Object.fromEntries(product.entitlements.map((x) => [x.entitlementKey, x.integerValue ?? x.stringValue ?? x.booleanValue]));
            const price = catalogPrice(product);
            const recommended = product.key === "GROWTH_SENDER_PACKAGE" || m.recommended === true;
            return (
              <form action={selectPlan} key={product.id} className={`funnel-card flex flex-col p-7 ${recommended ? "border-indigo-500 ring-2 ring-indigo-100" : ""}`}>
                <input type="hidden" name="productId" value={product.id} />
                {recommended && <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Recommended</p>}
                <h2 className="mt-2 text-3xl font-semibold text-slate-950">{product.name}</h2>
                <p className="mt-3 min-h-12 text-slate-700">{product.description ?? String(m.description ?? "A complete acquisition and delivery operating system.")}</p>
                <p className="mt-5 text-3xl font-semibold text-slate-950">
                  {price.configured ? money(price.recurringCents) : "Configured quote"}
                  <span className="text-sm font-normal text-slate-600"> / month</span>
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {price.configured ? `${money(price.oneTimeCents)} one-time setup` : "Setup confirmed before clearance"}
                </p>
                <ul className="mt-6 space-y-2 text-sm text-slate-800">
                  <li>✓ Complete Quantum Reach platform</li>
                  <li>✓ {Number(e.MANAGED_DOMAIN_ALLOWANCE ?? m.domains ?? 0)} managed domains</li>
                  <li>✓ {Number(e.MAILBOX_ALLOWANCE ?? m.mailboxes ?? 0)} managed mailboxes</li>
                  <li>✓ Approximately {Number(e.MONTHLY_SEND_ALLOWANCE ?? m.monthlySendAllowance ?? 0).toLocaleString()} mature monthly sends</li>
                  <li>✓ {Number(e.ACTIVE_OUTREACH_CONTACT_ALLOWANCE ?? 0).toLocaleString()} active CRM contacts</li>
                  <li>✓ {Number(e.TEAM_USER_ALLOWANCE ?? 0)} team users</li>
                  <li>✓ {String(m.onboarding ?? "Configured")} onboarding</li>
                  <li>✓ {String(m.support ?? "Configured")} support</li>
                </ul>
                <p className="mt-6 text-xs leading-5 text-slate-600">
                  Sending capacity becomes available gradually as managed domains and mailboxes complete Quantum Reach’s health-based warm-up process. Capacity depends on health, provider limits, recipient quality, and compliance.
                </p>
                <button className="funnel-primary mt-auto pt-6">
                  Choose {product.name}
                </button>
              </form>
            );
          })}
        </section>
        {!products.length && (
          <p role="alert" className="mt-10 rounded-xl bg-amber-50 p-5 text-amber-900">
            No active subscriber package is available.
          </p>
        )}
        <p className="mt-7 text-center text-sm text-slate-700">No payment, domain purchase, mailbox creation, or provider action occurs at this step.</p>
      </main>
    </FunnelShell>
  );
}
