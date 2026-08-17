import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { JourneyAction } from "@/lib/customer-journey/guided";

export type DashboardSnapshot = {
  leads: number; openOpportunities: number; pipelineValue: string; dueTasks: number;
  upcomingMeetings: number; campaigns: number; replies: number; proposalsNeedingAction: number;
  contractsNeedingAction: number; activeClients: number; readySenders: number; totalSenders: number;
};

const actions = [
  ["Add lead", "/dashboard/leads"], ["Import leads", "/dashboard/imports"],
  ["Create campaign", "/dashboard/campaigns"], ["View replies", "/dashboard/sending/deliverability"],
  ["Schedule meeting", "/dashboard/meetings/new"], ["Create proposal", "/dashboard/proposals"],
  ["Manage clients", "/dashboard/projects"], ["Continue setup", "/dashboard/onboarding"],
] as const;

function Metric({ label, value, href, detail }: { label: string; value: string | number; href: string; detail: string }) {
  return <Link href={href} className="rounded-xl border p-3 transition hover:border-sky-500 hover:bg-sky-50 dark:border-slate-800 dark:hover:bg-slate-900"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></Link>;
}

export function SaasDashboard({ workspaceName, snapshot, journey, createExample }: { workspaceName: string; snapshot: DashboardSnapshot; journey: { nextAction: JourneyAction; completed: number; total: number }; createExample: () => Promise<void> }) {
  const sending = snapshot.totalSenders === 0 ? "Setup required" : `${snapshot.readySenders}/${snapshot.totalSenders} ready`;
  const setupRequired = journey.nextAction.href === "/dashboard/onboarding";
  return <div className="space-y-6"><header><p className="text-sm font-medium text-slate-600 dark:text-slate-300">Your workspace</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{workspaceName} business dashboard</h1><p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">A workspace-scoped operating view based on persisted agency data.</p></header>
    <Card className="border-sky-200 bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/20"><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Your next best action · {journey.completed}/{journey.total}</p><CardTitle className="mt-2">{journey.nextAction.title}</CardTitle><CardDescription className="mt-2 max-w-2xl">{journey.nextAction.why}</CardDescription></div><Link href={journey.nextAction.href} className="rounded-md bg-sky-700 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{setupRequired ? "Continue setup" : "Continue"}</Link></div></CardHeader><CardContent><div className="h-2 overflow-hidden rounded-full bg-sky-100 dark:bg-sky-950" role="progressbar" aria-label="Workspace journey progress" aria-valuemin={0} aria-valuemax={journey.total} aria-valuenow={journey.completed}><div className="h-full bg-sky-600" style={{width:`${Math.round(journey.completed/journey.total*100)}%`}} /></div><p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{setupRequired ? "Required setup first — exploring prospects is optional until you finish." : <>Current stage: <strong>{journey.nextAction.stage}</strong>. Completion is derived from persisted workspace records.</>}</p></CardContent></Card>
    <Card><CardHeader><CardTitle>Start an agency task</CardTitle><CardDescription>Jump directly to common, workspace-safe operations. Example data is never created automatically.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">{actions.map(([label, href]) => <Link key={href} href={href} className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900">{label}</Link>)}<form action={createExample}><button className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Create example prospect</button></form></CardContent></Card>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Metric label="Leads" value={snapshot.leads} href="/dashboard/leads" detail="Persisted workspace leads" />
      <Metric label="Open opportunities" value={snapshot.openOpportunities} href="/dashboard/opportunities" detail={`Pipeline value: ${snapshot.pipelineValue}`} />
      <Metric label="Tasks needing attention" value={snapshot.dueTasks} href="/dashboard/tasks" detail="Open or due today" />
      <Metric label="Upcoming meetings" value={snapshot.upcomingMeetings} href="/dashboard/meetings" detail="Scheduled local meetings" />
      <Metric label="Campaigns" value={snapshot.campaigns} href="/dashboard/campaigns" detail="Active workspace campaigns" />
      <Metric label="Persisted replies" value={snapshot.replies} href="/dashboard/sending/deliverability" detail="Inbound messages received" />
      <Metric label="Proposals / contracts" value={`${snapshot.proposalsNeedingAction} / ${snapshot.contractsNeedingAction}`} href="/dashboard/proposals" detail="Draft or reviewable records" />
      <Metric label="Active clients" value={snapshot.activeClients} href="/dashboard/projects" detail={`Sending: ${sending}`} />
    </section>
  </div>;
}
