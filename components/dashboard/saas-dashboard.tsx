import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
const sections = [
 ["TODAY", ["Tasks due", "Meetings today", "Follow-ups required"]],
 ["SALES PIPELINE", ["Active opportunities", "Pipeline value", "Stage breakdown"]],
 ["OUTREACH", ["Active campaigns", "Recent sends", "Interested contacts", "Sending readiness"]],
 ["MEETINGS", ["Upcoming meetings", "Recently completed", "Needs analysis"]],
 ["DELIVERY", ["Proposals waiting", "Contracts waiting", "Onboarding clients"]],
 ["SYSTEM READINESS", ["Zoom connected", "Sending domain ready", "Sender identity ready", "Billing active", "Research configured"]],
];
export function SaasDashboard({workspaceName}:{workspaceName:string}){return <div className="space-y-6"><header><p className="text-sm font-medium text-slate-500">Subscriber workspace</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{workspaceName} business dashboard</h1><p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">Business execution metrics only: leads, meetings, proposals, contracts, pipeline, campaigns, sender health, tasks, and client onboarding.</p></header><section className="grid gap-4 md:grid-cols-3">{sections.map(([heading,items])=><Card key={heading as string}><CardHeader><CardTitle>{heading}</CardTitle><CardDescription>Workspace-scoped operating signals</CardDescription></CardHeader><CardContent className="space-y-2 text-sm">{(items as string[]).map((i)=><div key={i} className="flex justify-between rounded-xl border p-3 dark:border-slate-800"><span>{i}</span><strong>—</strong></div>)}</CardContent></Card>)}</section></div>}
