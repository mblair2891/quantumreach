import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUserProfile } from "@/lib/auth/rbac";
import { catalogPrice, loadValidatedDraft, money } from "@/lib/customer-journey/acquisition-draft";
import { buildAcquisitionChargeSummary } from "@/lib/commercial/charge-lines";
import { FunnelProgress } from "@/components/funnel/progress";
import { FunnelShell } from "@/components/funnel/shell";

export default async function Confirmation({ searchParams }: { searchParams: { submitted?: string } }) {
  let selection; try { selection = await loadValidatedDraft(); } catch { redirect("/start?selection=expired"); }
  const setupPrice = catalogPrice(selection.setup);
  const setupProductKey = selection.setup.key;
  if (!setupPrice.configured || (setupProductKey !== "STANDARD_SETUP" && setupProductKey !== "PRIORITY_SETUP")) redirect("/setup/priority");
  const charges = buildAcquisitionChargeSummary(selection.infrastructure.key, { productKey: setupProductKey, displayName: selection.setup.name, amountCents: setupPrice.oneTimeCents });
  const { userId } = await auth();
  if (searchParams.submitted === "1" && userId) {
    const user = await requireUserProfile();
    const order = await prisma.customerOrder.findFirst({ where: { userId: user.id, acquisitionSessionId: selection.session.id }, orderBy: { createdAt: "desc" } });
    if (order) return <FunnelShell><main className="mx-auto max-w-3xl px-5 py-16"><FunnelProgress current={6}/><p className="funnel-eyebrow">Order submitted</p><h1 className="funnel-title mt-3 text-4xl font-semibold">Your selections are saved.</h1><p className="mt-4 text-slate-600">Order {order.id} is <strong>unpaid</strong> and awaiting authorized operator clearance. No infrastructure purchase or provider provisioning is being claimed.</p><Link className="funnel-primary mt-7" href="/setup/status">View setup status</Link></main></FunnelShell>;
  }
  const resume = encodeURIComponent(selection.session.anonymousId ?? selection.session.id);
  const returnUrl = encodeURIComponent(`/join?resume=${resume}`);
  const plan = charges.plan;
  return <FunnelShell><main className="mx-auto max-w-4xl px-5 py-12 sm:py-16"><FunnelProgress current={4}/><p className="text-center funnel-eyebrow">Step 4 · Review</p><h1 className="text-center funnel-title mt-3 text-4xl font-semibold">Review your Quantum Reach order.</h1><p className="mx-auto mt-4 max-w-2xl text-center text-slate-600">Nothing has been charged and nothing has been provisioned. Your account and business profile are required before the canonical unpaid order is submitted.</p><section className="mt-10 rounded-2xl border bg-white p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold">{plan.name} package</h2><p className="mt-2 text-slate-600">Quantum Reach software included</p></div><Link className="text-sm font-semibold text-indigo-700 underline" href="/start">Edit package</Link></div><ul className="mt-5 grid gap-2 text-sm text-slate-700 sm:grid-cols-2"><li>{plan.domains.toLocaleString()} managed domains</li><li>{plan.mailboxes.toLocaleString()} mailboxes</li><li>{plan.contacts.toLocaleString()} contacts</li><li>{plan.teamUsers.toLocaleString()} team users</li><li>{plan.monthlySends.toLocaleString()} monthly sends</li><li>{money(plan.monthlyCents)}/month</li></ul></section><div className="mt-6 overflow-hidden rounded-2xl border bg-white"><Row label="Monthly package fee" value={money(plan.monthlyCents)}/><Row label="One-time implementation fee" value={money(plan.setupCents)}/><Row label="Setup priority" value={selection.setup.name} edit="/setup/priority"/><Row label={selection.setup.key === "STANDARD_SETUP" ? "Standard" : "Head of the line"} value={setupPrice.oneTimeCents === 0 ? "Included" : money(setupPrice.oneTimeCents)}/><Row label="Priority surcharge" value={money(setupPrice.oneTimeCents)}/><Row label="First month’s package fee" value={money(plan.monthlyCents)}/><Row label="Today’s subtotal" value={money(charges.todaySubtotalCents)}/><Row label="Today’s total" value={money(charges.todayTotalCents)}/><Row label="Recurring monthly fee" value={`${money(charges.recurringMonthlyCents)}/month`}/><Row label="Financial state" value="Unpaid · awaiting authorized clearance"/></div><div className="mt-8 rounded-xl bg-amber-50 p-5 text-sm text-amber-900">Provider provisioning is deferred until authorized clearance and operator review. This review does not claim payment, domain registration, mailbox creation, or sending readiness.</div>{userId ? <Link className="funnel-primary mt-7 flex w-full" href={`/join?resume=${resume}`}>Continue to business profile</Link> : <div className="mt-7 grid gap-3 sm:grid-cols-2"><Link className="funnel-primary w-full" href={`/sign-up?redirect_url=${returnUrl}`}>Create account and continue</Link><Link className="funnel-secondary w-full" href={`/sign-in?redirect_url=${returnUrl}`}>Sign in and continue</Link></div>}</main></FunnelShell>;
}

function Row({ label, value, edit }: { label: string; value: string; edit?: string }) { return <div className="flex items-center justify-between gap-5 border-b px-5 py-4 last:border-0"><span className="text-slate-600">{label}</span><span className="text-right font-semibold">{value}{edit && <Link className="ml-3 text-sm text-indigo-700 underline" href={edit}>Edit</Link>}</span></div>; }
