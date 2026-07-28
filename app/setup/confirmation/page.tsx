import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUserProfile } from "@/lib/auth/rbac";
import { loadValidatedDraft, money, summarizeDraft } from "@/lib/customer-journey/acquisition-draft";
import { FunnelProgress } from "@/components/funnel/progress";
import { FunnelShell } from "@/components/funnel/shell";

export default async function Confirmation({ searchParams }: { searchParams: { submitted?: string } }) {
  let selection; try { selection = await loadValidatedDraft(); } catch { redirect("/start?selection=expired"); }
  const totals = summarizeDraft(selection);
  const { userId } = await auth();
  if (searchParams.submitted === "1" && userId) {
    const user = await requireUserProfile();
    const order = await prisma.customerOrder.findFirst({ where: { userId: user.id, acquisitionSessionId: selection.session.id }, orderBy: { createdAt: "desc" } });
    if (order) return <FunnelShell><main className="mx-auto max-w-3xl px-5 py-16"><FunnelProgress current={6}/><p className="funnel-eyebrow">Order submitted</p><h1 className="funnel-title mt-3 text-4xl font-semibold">Your selections are saved.</h1><p className="mt-4 text-slate-600">Order {order.id} is <strong>unpaid</strong> and awaiting authorized operator clearance. No infrastructure purchase or provider provisioning is being claimed.</p><Link className="funnel-primary mt-7" href="/setup/status">View setup status</Link></main></FunnelShell>;
  }
  const resume = encodeURIComponent(selection.session.anonymousId ?? selection.session.id);
  const returnUrl = encodeURIComponent(`/join?resume=${resume}`);
  return <FunnelShell><main className="mx-auto max-w-4xl px-5 py-12 sm:py-16"><FunnelProgress current={4}/><p className="text-center funnel-eyebrow">Step 4 · Review</p><h1 className="text-center funnel-title mt-3 text-4xl font-semibold">Review your Quantum Reach order.</h1><p className="mx-auto mt-4 max-w-2xl text-center text-slate-600">Nothing has been charged or provisioned. Your account and business profile are required before the canonical unpaid order is submitted.</p><div className="mt-10 overflow-hidden rounded-2xl border bg-white"><Row label="Core software" value={selection.core.name} edit="/start"/><Row label="Software recurring" value={price(totals.core.recurringCents, totals.core.configured)} /><Row label="Software setup" value={price(totals.core.oneTimeCents, totals.core.configured)} /><Row label="Infrastructure" value={selection.infrastructure.name} edit="/setup/infrastructure"/><Row label="Infrastructure recurring" value={price(totals.infrastructure.recurringCents, totals.infrastructure.configured)}/><Row label="Infrastructure one-time" value={price(totals.infrastructure.oneTimeCents, totals.infrastructure.configured)}/><Row label="Setup priority" value={selection.setup.name} edit="/setup/priority"/><Row label="Priority price" value={price(totals.setup.oneTimeCents || totals.setup.recurringCents, totals.setup.configured)}/><Row label="Expected initial total" value={configured(totals) ? money(totals.oneTimeCents + totals.recurringCents) : "Confirmed before clearance"}/><Row label="Expected recurring total" value={configured(totals) ? `${money(totals.recurringCents)} / billing period` : "Confirmed before clearance"}/><Row label="Financial state" value="Unpaid · awaiting authorized clearance"/></div><div className="mt-8 rounded-xl bg-amber-50 p-5 text-sm text-amber-900">Provider provisioning is deferred until authorized clearance and operator review. This review does not claim payment, domain registration, mailbox creation, or sending readiness.</div>{userId ? <Link className="funnel-primary mt-7 flex w-full" href={`/join?resume=${resume}`}>Continue to business profile</Link> : <div className="mt-7 grid gap-3 sm:grid-cols-2"><Link className="funnel-primary w-full" href={`/sign-up?redirect_url=${returnUrl}`}>Create account and continue</Link><Link className="funnel-secondary w-full" href={`/sign-in?redirect_url=${returnUrl}`}>Sign in and continue</Link></div>}</main></FunnelShell>;
}

function configured(totals: ReturnType<typeof summarizeDraft>) { return totals.core.configured && totals.infrastructure.configured && totals.setup.configured; }
function price(cents: number, isConfigured: boolean) { return isConfigured ? money(cents) : "Configured manually"; }
function Row({ label, value, edit }: { label: string; value: string; edit?: string }) { return <div className="flex items-center justify-between gap-5 border-b px-5 py-4 last:border-0"><span className="text-slate-600">{label}</span><span className="text-right font-semibold">{value}{edit && <Link className="ml-3 text-sm text-indigo-700 underline" href={edit}>Edit</Link>}</span></div>; }
