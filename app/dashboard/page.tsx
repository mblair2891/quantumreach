import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentWorkspace } from "@/lib/workspaces/service";
import { getWorkflowStatusSummary } from "@/lib/workflows/service";

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "amber" | "blue" | "green" }) {
  const tones = { slate: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200", amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100", blue: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100", green: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function MetricCard({ label, value, detail, href }: { label: string; value: number; detail: string; href: string }) {
  return <Link href={href} className="block rounded-2xl border border-border bg-white p-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-800/70">
    <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-50">{value.toLocaleString()}</p>
    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{detail}</p>
  </Link>;
}

function eventLabel(action: string) {
  return action.replace(/[._]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function Page() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) redirect("/onboarding");
  const summary = await getWorkflowStatusSummary(workspace.id);
  const readyCount = summary.readinessChecklist.filter((item) => item.complete).length;

  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Operational readiness</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Executive dashboard</h1>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">A workspace-scoped snapshot of what needs attention, what is ready for the next step, where work is stuck, and which outputs were generated recently.</p>
      </div>
      <Button asChild variant="outline"><Link href="/dashboard/knowledge">Review knowledge readiness</Link></Button>
    </header>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Leads by outreach status" value={summary.leadsNotStarted + summary.leadsInOutreach + summary.leadsReplied} detail={`${summary.leadsNotStarted} not started · ${summary.leadsInOutreach} in outreach · ${summary.leadsReplied} replied/advanced`} href="/dashboard/leads" />
      <MetricCard label="Active outreach campaigns" value={summary.activeCampaigns} detail="Campaigns available for assigned leads" href="/dashboard/outreach" />
      <MetricCard label="Recent calls" value={summary.recentCalls.length} detail={`${summary.callsScheduled} scheduled · ${summary.callsNeedingTranscript} needing transcript`} href="/dashboard/calls" />
      <MetricCard label="Calls needing transcript" value={summary.callsNeedingTranscript} detail="Completed calls blocked before diagnostics" href="/dashboard/calls" />
      <MetricCard label="Diagnostics needing analysis" value={summary.diagnosticsReadyForAnalysis} detail="Transcript-ready diagnostics without analysis" href="/dashboard/diagnostics" />
      <MetricCard label="Analyses needing review" value={summary.analysesNeedingReview} detail={`${summary.analysesReviewedFinal} reviewed or final`} href="/dashboard/analysis" />
      <MetricCard label="Reports / roadmaps / proposals" value={summary.deliverablesGenerated} detail={`${summary.reportsGenerated} reports · ${summary.roadmapsGenerated} roadmaps · ${summary.proposalsGenerated} proposals`} href="/dashboard/reports" />
      <MetricCard label="Knowledge source coverage" value={summary.knowledgeCoverageWarnings.length} detail="Warnings and setup confirmations" href="/dashboard/knowledge" />
    </section>

    <section className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Next recommended actions</CardTitle><CardDescription>Deterministic guidance from current workflow state. No AI is used.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {summary.nextRecommendedActions.map((action) => <Link key={action.title} href={action.href} className="rounded-2xl border border-border p-4 hover:bg-slate-50 dark:hover:bg-slate-900">
            <div className="flex items-start justify-between gap-3"><h2 className="font-semibold text-slate-900 dark:text-slate-50">{action.title}</h2><Badge tone={action.tone}>{action.tone}</Badge></div>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{action.detail}</p>
          </Link>)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Production readiness checklist</CardTitle><CardDescription>{readyCount} of {summary.readinessChecklist.length} checks passing.</CardDescription></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {summary.readinessChecklist.map((item) => <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border p-3 dark:border-slate-800"><span>{item.label}</span><Badge tone={item.complete ? "green" : "amber"}>{item.complete ? "Ready" : "Needs setup"}</Badge></div>)}
        </CardContent>
      </Card>
    </section>

    <section className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader><CardTitle>Workflow status summary</CardTitle><CardDescription>Counts are computed from existing workspace records.</CardDescription></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Leads not started: <strong>{summary.leadsNotStarted}</strong></p>
          <p>Leads in outreach: <strong>{summary.leadsInOutreach}</strong></p>
          <p>Leads replied/advanced: <strong>{summary.leadsReplied}</strong></p>
          <p>Calls scheduled: <strong>{summary.callsScheduled}</strong></p>
          <p>Calls transcript-ready: <strong>{summary.callsTranscriptReady}</strong></p>
          <p>Diagnostics ready for analysis: <strong>{summary.diagnosticsReadyForAnalysis}</strong></p>
          <p>Analyses needing review: <strong>{summary.analysesNeedingReview}</strong></p>
          <p>Analyses reviewed/final: <strong>{summary.analysesReviewedFinal}</strong></p>
          <p>Deliverables generated: <strong>{summary.deliverablesGenerated}</strong></p>
          <p>Knowledge coverage warnings: <strong>{summary.knowledgeCoverageWarnings.length}</strong></p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Knowledge coverage readiness</CardTitle><CardDescription>Active doctrine and framework coverage.</CardDescription></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Global doctrine: <strong>{summary.knowledgeCoverage.globalDoctrine}</strong></p>
          <p>Diagnostic/transcript framework: <strong>{summary.knowledgeCoverage.diagnosticFramework}</strong></p>
          <p>Report framework: <strong>{summary.knowledgeCoverage.reportFramework}</strong></p>
          <p>Roadmap framework: <strong>{summary.knowledgeCoverage.roadmapFramework}</strong></p>
          <p>Proposal framework: <strong>{summary.knowledgeCoverage.proposalFramework}</strong></p>
          <p>Execution handoff framework: <strong>{summary.knowledgeCoverage.executionHandoffFramework}</strong></p>
          <div className="space-y-2 pt-2">{summary.knowledgeCoverageWarnings.map((warning) => <p key={warning} className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{warning}</p>)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recent activity</CardTitle><CardDescription>Human-readable audit summary without raw JSON.</CardDescription></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {summary.recentAudit.map((event) => <div key={event.id} className="rounded-xl border p-3 dark:border-slate-800"><p className="font-medium">{eventLabel(event.action)}</p><p className="text-slate-500 dark:text-slate-400">{event.entityType} · {event.createdAt.toLocaleString()}</p></div>)}
          {summary.recentAudit.length === 0 ? <p className="text-slate-500 dark:text-slate-400">No recent audit events recorded yet.</p> : null}
        </CardContent>
      </Card>
    </section>

    <Card>
      <CardHeader><CardTitle>Recently updated calls and linked outputs</CardTitle><CardDescription>Call-level workflow hub links for diagnostics, analyses, reports, roadmaps, and proposals.</CardDescription></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {summary.recentCalls.map((call) => {
          const diagnostic = call.diagnostics[0];
          const analysis = diagnostic?.analyses[0];
          return <div key={call.id} className="rounded-2xl border p-4 dark:border-slate-800">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><Link href={`/dashboard/calls/${call.id}`} className="font-semibold underline">Call {call.callDate?.toLocaleDateString() ?? call.updatedAt.toLocaleDateString()}</Link><p className="mt-1 text-slate-600 dark:text-slate-300">{call.lead?.name ?? call.opportunity?.name ?? "Unlinked call"} · {call.status}</p></div><Badge>{call.transcriptText ? "Transcript present" : "Transcript needed"}</Badge></div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {diagnostic ? <Link className="underline" href={`/dashboard/diagnostics/${diagnostic.id}`}>Diagnostic</Link> : <span className="text-slate-500">No diagnostic</span>}
              {analysis ? <Link className="underline" href={`/dashboard/analysis/${analysis.id}`}>Analysis</Link> : <span className="text-slate-500">No analysis</span>}
              {analysis?.reports.map((report) => <Link key={report.id} className="underline" href={`/dashboard/reports/${report.id}`}>Report</Link>)}
              {analysis?.roadmaps.map((roadmap) => <Link key={roadmap.id} className="underline" href={`/dashboard/roadmaps/${roadmap.id}`}>Roadmap</Link>)}
              {analysis?.proposals.map((proposal) => <Link key={proposal.id} className="underline" href={`/dashboard/proposals/${proposal.id}`}>Proposal</Link>)}
            </div>
          </div>;
        })}
        {summary.recentCalls.length === 0 ? <p className="text-slate-500 dark:text-slate-400">No calls yet. Create a call, add transcript text, then generate a diagnostic.</p> : null}
      </CardContent>
    </Card>
  </div>;
}
