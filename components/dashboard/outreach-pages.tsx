import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, emptyStateCopy } from "@/components/dashboard/empty-state";
import { Input } from "@/components/ui/input";
import { getCurrentWorkspace } from "@/lib/workspaces/service";
import { listLeads } from "@/lib/crm/service";
import { assignLeadToCampaign, createOutreachCampaign, getOutreachCampaignDetail, listOutreachCampaigns, updateLeadOutreachStatus } from "@/lib/workflows/service";

const outreachStatuses = ["NOT_STARTED", "QUEUED", "SENT", "OPENED", "REPLIED", "CALL_BOOKED", "CALL_COMPLETED", "TRANSCRIPT_READY", "ANALYZED"] as const;

function formatDate(value: Date) {
  return value.toLocaleString();
}

async function requireWorkspace() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;
  return workspace;
}

export async function OutreachListPage() {
  const workspace = await requireWorkspace();
  if (!workspace) return <EmptyWorkspace />;
  const campaigns = await listOutreachCampaigns(workspace.id);

  async function create(formData: FormData) {
    "use server";
    const workspace = await requireWorkspace();
    if (!workspace) return;
    await createOutreachCampaign(workspace.id, Object.fromEntries(formData));
    revalidatePath("/dashboard/outreach");
  }

  return <div className="space-y-6"><div><h1 className="text-3xl font-semibold">Outreach campaigns</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Manual campaign and lead status tracking. Live email automation, open/click tracking, and reply parsing are deferred.</p></div><Card><CardHeader><CardTitle>Create campaign</CardTitle><CardDescription>Safe tracking foundation only.</CardDescription></CardHeader><form action={create} className="grid gap-3 p-6 pt-0 md:grid-cols-3"><Input name="name" placeholder="Campaign name" required /><Input name="description" placeholder="Description" /><Button type="submit">Create</Button></form></Card><Card><CardHeader><CardTitle>{campaigns.length} campaigns</CardTitle><CardDescription>Open a campaign to assign leads and manually update outreach status.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{campaigns.map((campaign) => <Link key={campaign.id} href={`/dashboard/outreach/${campaign.id}`} className="group rounded-xl border border-border p-4 transition hover:border-slate-400 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-900"><div className="flex items-start justify-between gap-4"><div><p className="font-medium text-slate-950 group-hover:underline dark:text-slate-50">{campaign.name}</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{campaign.description ?? "No description"}</p></div><span className="rounded-full border border-border px-2 py-1 text-xs text-slate-500 dark:text-slate-400">{campaign.status}</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-500 dark:text-slate-400"><p><span className="block text-base font-semibold text-slate-900 dark:text-slate-100">{campaign.leadStatuses.length}</span>leads</p><p><span className="block text-base font-semibold text-slate-900 dark:text-slate-100">{campaign.steps.length}</span>steps</p><p><span className="block text-base font-semibold text-slate-900 dark:text-slate-100">{formatDate(campaign.updatedAt)}</span>updated</p></div></Link>)}{campaigns.length === 0 ? <EmptyState {...emptyStateCopy.outreach} /> : null}</CardContent></Card></div>;
}

export async function OutreachDetailPage({ id }: { id: string }) {
  const workspace = await requireWorkspace();
  if (!workspace) return <EmptyWorkspace />;
  const [campaign, leads] = await Promise.all([getOutreachCampaignDetail(workspace.id, id), listLeads(workspace.id)]);
  const assignedLeadIds = new Set(campaign.leadStatuses.map((item) => item.leadId));
  const assignableLeads = leads.filter((lead) => !assignedLeadIds.has(lead.id));

  async function assignLead(formData: FormData) {
    "use server";
    const workspace = await requireWorkspace();
    if (!workspace) return;
    await assignLeadToCampaign(workspace.id, id, Object.fromEntries(formData));
    revalidatePath(`/dashboard/outreach/${id}`);
    revalidatePath("/dashboard/outreach");
  }

  async function updateStatus(formData: FormData) {
    "use server";
    const workspace = await requireWorkspace();
    if (!workspace) return;
    const input = Object.fromEntries(formData);
    const leadId = String(input.leadId ?? "");
    await updateLeadOutreachStatus(workspace.id, leadId, { campaignId: id, status: input.status, notes: input.notes });
    revalidatePath(`/dashboard/outreach/${id}`);
    revalidatePath("/dashboard/outreach");
  }

  return <div className="space-y-6"><div><Link className="text-sm text-slate-500 hover:underline dark:text-slate-400" href="/dashboard/outreach">← Back to outreach campaigns</Link><div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-start"><div><h1 className="text-3xl font-semibold">{campaign.name}</h1><p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">{campaign.description ?? "No description has been added to this campaign."}</p></div><span className="rounded-full border border-border px-3 py-1 text-sm text-slate-600 dark:text-slate-300">{campaign.status}</span></div></div><div className="grid gap-4 lg:grid-cols-3"><Card><CardHeader><CardTitle>Campaign overview</CardTitle><CardDescription>Workspace-scoped campaign metadata.</CardDescription></CardHeader><div className="space-y-2 p-6 pt-0 text-sm text-slate-600 dark:text-slate-300"><p><span className="font-medium text-slate-900 dark:text-slate-100">Workspace:</span> {workspace.name}</p><p><span className="font-medium text-slate-900 dark:text-slate-100">Created:</span> {formatDate(campaign.createdAt)}</p><p><span className="font-medium text-slate-900 dark:text-slate-100">Updated:</span> {formatDate(campaign.updatedAt)}</p></div></Card><Card><CardHeader><CardTitle>Lead tracking</CardTitle><CardDescription>Manual outreach status coverage.</CardDescription></CardHeader><div className="grid grid-cols-2 gap-3 p-6 pt-0 text-sm"><p className="rounded-xl border border-border p-3"><span className="block text-2xl font-semibold">{campaign.leadStatuses.length}</span><span className="text-slate-500 dark:text-slate-400">assigned leads</span></p><p className="rounded-xl border border-border p-3"><span className="block text-2xl font-semibold">{campaign.steps.length}</span><span className="text-slate-500 dark:text-slate-400">campaign steps</span></p></div></Card><Card><CardHeader><CardTitle>Guardrails</CardTitle><CardDescription>Foundation-only workflow.</CardDescription></CardHeader><div className="space-y-2 p-6 pt-0 text-sm text-slate-600 dark:text-slate-300"><p>No live email sending.</p><p>No open/click tracking.</p><p>No reply parsing or automation.</p></div></Card></div><Card><CardHeader><CardTitle>Assign a lead</CardTitle><CardDescription>Assign a lead to begin tracking outreach.</CardDescription></CardHeader><form action={assignLead} className="grid gap-3 p-6 pt-0 md:grid-cols-3"><select name="leadId" required className="rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">Select an existing lead</option>{assignableLeads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}{lead.email ? ` — ${lead.email}` : ""}</option>)}</select><Input name="notes" placeholder="Initial notes (optional)" /><Button type="submit" disabled={assignableLeads.length === 0}>Assign lead</Button></form>{leads.length === 0 ? <p className="px-6 pb-6 text-sm text-slate-500 dark:text-slate-400">No CRM leads exist yet. Create a lead before assigning campaign outreach.</p> : null}{leads.length > 0 && assignableLeads.length === 0 ? <p className="px-6 pb-6 text-sm text-slate-500 dark:text-slate-400">All existing leads are already assigned to this campaign.</p> : null}</Card><Card><CardHeader><CardTitle>Assigned leads</CardTitle><CardDescription>Update each lead through the Phase 4 outreach status model.</CardDescription></CardHeader><CardContent className="space-y-3">{campaign.leadStatuses.map((item) => <div key={item.id} className="rounded-xl border border-border p-4"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-start"><div><Link href={`/dashboard/leads/${item.lead.id}`} className="font-medium text-slate-950 hover:underline dark:text-slate-50">{item.lead.name}</Link><p className="text-sm text-slate-500 dark:text-slate-400">{item.lead.email ?? "No email"} · Updated {formatDate(item.updatedAt)}</p><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.notes ?? "No notes recorded."}</p></div><span className="rounded-full border border-border px-3 py-1 text-sm text-slate-600 dark:text-slate-300">{item.status}</span></div><form action={updateStatus} className="mt-4 grid gap-3 md:grid-cols-4"><input type="hidden" name="leadId" value={item.leadId} /><select name="status" defaultValue={item.status} className="rounded-md border border-input bg-background px-3 py-2 text-sm">{outreachStatuses.map((status) => <option key={status}>{status}</option>)}</select><Input name="notes" placeholder="Status notes" defaultValue={item.notes ?? ""} /><Button type="submit">Update status</Button></form></div>)}{campaign.leadStatuses.length === 0 ? <div className="rounded-xl border border-dashed border-border p-6 text-sm text-slate-500 dark:text-slate-400"><p>No leads assigned to this campaign yet.</p><p className="mt-1">Assign a lead to begin tracking outreach.</p></div> : null}</CardContent></Card><Card><CardHeader><CardTitle>Campaign steps</CardTitle><CardDescription>Read-only campaign step foundation, if configured.</CardDescription></CardHeader><CardContent className="space-y-3">{campaign.steps.map((step) => <div key={step.id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-medium">{step.position + 1}. {step.name}</p><p className="text-sm text-slate-500 dark:text-slate-400">{step.description ?? "No description"}</p></div><span className="rounded-full border border-border px-2 py-1 text-xs text-slate-500 dark:text-slate-400">{step.status}</span></div></div>)}{campaign.steps.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-sm text-slate-500 dark:text-slate-400">No campaign steps configured yet.</p> : null}</CardContent></Card></div>;
}

function EmptyWorkspace() {
  return <Card><CardHeader><CardTitle>No active workspace</CardTitle><CardDescription>Create or join a workspace before using outreach workflows.</CardDescription></CardHeader></Card>;
}
