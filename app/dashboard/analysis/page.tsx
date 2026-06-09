import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentWorkspace } from "@/lib/workspaces/service";
import { listAnalysisRecords } from "@/lib/reports/service";
import { EmptyState, emptyStateCopy } from "@/components/dashboard/empty-state";

function StatusBadge({ status }: { status: string }) {
  const tone = status === "FINAL"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
    : status === "REVIEWED" || status === "GENERATED"
      ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
      : status === "REJECTED" || status === "ARCHIVED"
        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{status.replace(/_/g, " ")}</span>;
}

function formatDate(value: Date) {
  return value.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function crmContextLabel(record: Awaited<ReturnType<typeof listAnalysisRecords>>[number]) {
  if (!record.session) return "No linked diagnostic session";
  const related = record.session.relatedType ? `${record.session.relatedType}${record.session.relatedId ? ` • ${record.session.relatedId}` : ""}` : "Unlinked CRM context";
  return `${record.session.title} • ${related}`;
}

export default async function Page() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) redirect("/onboarding");

  const records = await listAnalysisRecords(workspace.id);
  const needsReview = records.filter((record) => record.status === "DRAFT" || record.status === "NEEDS_REVIEW").length;
  const finalRecords = records.filter((record) => record.status === "FINAL").length;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-3xl font-semibold">Analysis records</h1>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">Workspace-scoped diagnostic intelligence ready for human review, final approval, and deliverable generation.</p>
      </div>
      <Button asChild variant="outline"><Link href="/dashboard/diagnostics">Open diagnostics</Link></Button>
    </div>

    <div className="grid gap-4 md:grid-cols-3">
      <Card><CardHeader><CardTitle>{records.length}</CardTitle><CardDescription>Workspace records</CardDescription></CardHeader></Card>
      <Card><CardHeader><CardTitle>{needsReview}</CardTitle><CardDescription>Need review</CardDescription></CardHeader></Card>
      <Card><CardHeader><CardTitle>{finalRecords}</CardTitle><CardDescription>Final analysis records</CardDescription></CardHeader></Card>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Review queue</CardTitle>
        <CardDescription>Only records in your active workspace are shown. Select a record to open review actions and deliverable workflows.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {records.map((record) => {
          const model = record.session?.analyzerRuns[0]?.executions[0]?.model ?? "—";
          return <Link key={record.id} href={`/dashboard/analysis/${record.id}`} className="block rounded-2xl border border-border bg-white p-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-800/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-slate-50">{record.title}</h2>
                  <StatusBadge status={record.status} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{record.summary || "No summary has been captured yet."}</p>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Diagnostic / CRM context</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{crmContextLabel(record)}</p>
              </div>
              <div className="min-w-48 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                <p><span className="font-medium text-slate-900 dark:text-slate-50">Model:</span> {model}</p>
                <p><span className="font-medium text-slate-900 dark:text-slate-50">Created:</span> {formatDate(record.createdAt)}</p>
                <p><span className="font-medium text-slate-900 dark:text-slate-50">Updated:</span> {formatDate(record.updatedAt)}</p>
                <p><span className="font-medium text-slate-900 dark:text-slate-50">Diagnostic:</span> {record.sessionId ?? "—"}</p>
              </div>
            </div>
          </Link>;
        })}
        {records.length === 0 ? <EmptyState {...emptyStateCopy.analysis} /> : null}
      </CardContent>
    </Card>
  </div>;
}
