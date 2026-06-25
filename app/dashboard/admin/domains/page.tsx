import { getOperatorDomainSummary } from "@/lib/managed-domains/service";
export default async function OperatorManagedDomainsPage() {
  const summary = await getOperatorDomainSummary();
  const cards = [
    ["Managed domains", summary.total], ["Warming", summary.warming], ["Active", summary.active], ["Paused or burned", summary.pausedOrBurned], ["Unassigned inventory", summary.unassigned], ["Need DNS", summary.needingDns], ["Need SES", summary.needingSes], ["Approved purchase requests", summary.purchaseRequestsPendingApproval],
  ];
  return <main className="space-y-6 p-8"><div><h1 className="text-3xl font-semibold">Managed domain operations</h1><p className="text-sm text-slate-600">Safe operator view for domain inventory, DNS, SES, warmup, billing, and deliverability health signals. Provider credentials and raw recipient lists are never shown.</p></div><section className="grid gap-4 md:grid-cols-4">{cards.map(([label, value]) => <div className="rounded-lg border bg-white p-4" key={label}><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-semibold">{value}</p></div>)}</section><section className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">Live domain purchasing and DNS automation remain disabled until environment flags and provider credentials are configured. Domain warmup improves risk management but does not guarantee inbox placement.</section></main>;
}
