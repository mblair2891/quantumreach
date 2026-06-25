/* eslint-disable @typescript-eslint/no-explicit-any */
import { listWorkspaceDomains } from "@/lib/managed-domains/service";
export default async function WorkspaceSendingDomainsPage() {
  const workspaceId = process.env.DEMO_WORKSPACE_ID || "";
  const domains = workspaceId ? await listWorkspaceDomains(workspaceId) : [];
  return <main className="space-y-6 p-8"><div><h1 className="text-3xl font-semibold">Sending domains</h1><p className="text-sm text-slate-600">Request a managed domain or bring your own domain for DNS and SES verification before sending.</p></div><div className="rounded-lg border bg-blue-50 p-4 text-sm text-blue-900">Domain warmup improves risk management but does not guarantee inbox placement. Workspace-owned or dedicated domains are preferred over broad shared domains.</div><section className="space-y-3">{domains.length === 0 ? <p className="rounded-lg border p-4 text-sm text-slate-600">No assigned domains are visible for this workspace yet.</p> : domains.map((d:any) => <article className="rounded-lg border p-4" key={d.id}><h2 className="font-medium">{d.domainName}</h2><p>Status: {d.lifecycleStatus}; DNS records: {d.dnsRecords.length}; SES: {d.sesIdentity?.verificationStatus ?? "not connected"}; Warmup: {d.warmupPlan?.status ?? "not started"}</p></article>)}</section></main>;
}
