/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkedCrmContextCard } from "@/components/dashboard/linked-crm-context-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { getCurrentWorkspace } from "@/lib/workspaces/service";
import { getDiagnosticDetail, listDiagnostics, saveTranscriptContext } from "@/lib/diagnostics/service";
import { runDiagnosticSummaryAnalyzer } from "@/lib/ai/orchestration";
import { formatSeverityLabel, normalizeRiskAssumptionSections, type ReportRisk } from "@/lib/diagnostics/report-sections";

function getNormalizationWarnings(content: unknown) {
  if (!content || typeof content !== "object" || Array.isArray(content)) return [];
  const warnings = (content as { normalizationWarnings?: unknown }).normalizationWarnings;
  return Array.isArray(warnings) ? warnings.filter((warning): warning is string => typeof warning === "string" && warning.length > 0) : [];
}

export async function DiagnosticsListPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return <Card><CardHeader><CardTitle>No active workspace</CardTitle><CardDescription>Create or join a workspace to run diagnostics.</CardDescription></CardHeader></Card>;
  const diagnostics = await listDiagnostics(workspace.id);
  return <div className="space-y-6"><div><h1 className="text-3xl font-semibold">Diagnostics</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Workspace-scoped discovery sessions that transform CRM context into review-ready intelligence.</p></div><Card><CardHeader><CardTitle>{diagnostics.length} sessions</CardTitle><CardDescription>Start diagnostics from CRM detail pages so context is preserved.</CardDescription></CardHeader><div className="space-y-3 p-6 pt-0">{diagnostics.map((session) => <Link href={`/dashboard/diagnostics/${session.id}`} key={session.id} className="block rounded-xl border p-4 hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:bg-slate-900/60"><div className="flex justify-between"><p className="font-medium">{session.title}</p><p className="text-sm text-slate-500 dark:text-slate-400">{session.status}</p></div><p className="text-sm text-slate-600 dark:text-slate-300">{session.relatedType ?? "Unlinked"} • {session.transcripts[0] ? "Transcript ready" : "Context pending"}</p></Link>)}{diagnostics.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No diagnostics yet. Open a CRM record and choose Start diagnostic.</p> : null}</div></Card></div>;
}

export async function DiagnosticDetailPage({ id }: { id: string }) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;
  const { session, crmContext } = await getDiagnosticDetail(workspace.id, id);
  const latestTranscript = session.transcripts[0] as any;
  const latestRun = session.analyzerRuns[0];
  const latestAnalysis = session.analyses[0];
  const normalizationWarnings = getNormalizationWarnings(latestRun?.artifacts[0]?.content);
  async function saveAction(formData: FormData) { "use server"; const workspace = await getCurrentWorkspace(); if (!workspace) return; await saveTranscriptContext(workspace.id, id, Object.fromEntries(formData.entries())); revalidatePath(`/dashboard/diagnostics/${id}`); }
  async function analyzeAction() { "use server"; const workspace = await getCurrentWorkspace(); if (!workspace) return; await runDiagnosticSummaryAnalyzer(workspace.id, id); revalidatePath(`/dashboard/diagnostics/${id}`); }
  return <div className="space-y-6"><div><Link href="/dashboard/diagnostics" className="text-sm text-slate-500 dark:text-slate-400 hover:underline">← Back to diagnostics</Link><h1 className="mt-2 text-3xl font-semibold">{session.title}</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Status: {session.status}. Intelligence remains review-needed until a human approves it.</p></div><div className="grid gap-4 lg:grid-cols-3"><LinkedCrmContextCard relatedType={session.relatedType} crmContext={crmContext} /><Card><CardHeader><CardTitle>Analyzer state</CardTitle><CardDescription>{latestRun ? `${latestRun.status} • ${latestRun.reviewStatus}` : "No analyzer run yet"}</CardDescription></CardHeader><div className="p-6 pt-0 text-sm text-slate-600 dark:text-slate-300"><p>Model: {latestRun?.executions[0]?.model ?? "—"}</p><p>Generated: {latestRun?.completedAt?.toLocaleString() ?? "—"}</p>{normalizationWarnings.length > 0 ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100"><p className="font-medium">Structured output was prepared for review.</p><ul className="mt-2 list-disc space-y-1 pl-5">{normalizationWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : latestRun?.error ? <p className="mt-2 text-amber-700 dark:text-amber-200">Review needed: {latestRun.error}</p> : null}</div></Card><Card><CardHeader><CardTitle>Decision posture</CardTitle><CardDescription>Outputs are analytical records, not CRM overwrites.</CardDescription></CardHeader><form action={analyzeAction} className="p-6 pt-0"><Button type="submit" disabled={!latestTranscript}>Run Diagnostic Summary + Constraint Extraction</Button></form></Card></div><Card><CardHeader><CardTitle>Transcript and business context</CardTitle><CardDescription>Paste transcript, discovery notes, and operating context. Saving moves the session to transcript-ready.</CardDescription></CardHeader><form action={saveAction} className="grid gap-3 p-6 pt-0"><Textarea name="transcript" placeholder="Transcript text" defaultValue={latestTranscript?.content ?? ""} /><Textarea name="discoveryNotes" placeholder="Discovery notes" defaultValue={latestTranscript?.discoveryNotes ?? ""} /><Textarea name="businessContext" placeholder="Business context" defaultValue={latestTranscript?.businessContext ?? ""} /><Button type="submit" className="self-start">Save transcript/context</Button></form></Card>{latestTranscript ? <Card><CardHeader><CardTitle>Saved context preview</CardTitle><CardDescription>Most recent manual context entry.</CardDescription></CardHeader><p className="whitespace-pre-wrap p-6 pt-0 text-sm text-slate-700 dark:text-slate-200">{latestTranscript.content.slice(0, 1800)}</p></Card> : null}{latestAnalysis ? <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Report-ready intelligence</CardTitle><CardDescription>{latestAnalysis.status} • Generated {latestAnalysis.updatedAt.toLocaleString()}</CardDescription></div><Button asChild><Link href={`/dashboard/analysis/${latestAnalysis.id}`}>Open analysis review</Link></Button></div></CardHeader><div className="space-y-5 p-6 pt-0"><section><h2 className="font-semibold">Diagnostic summary</h2><p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{latestAnalysis.summary}</p></section><ResultList title="Constraints" items={latestAnalysis.constraints} text={(item: any) => `${item.label}: ${item.impact ?? ""} Evidence: ${item.evidence ?? ""}`} /><ResultList title="Bottlenecks" items={latestAnalysis.bottlenecks} text={(item: any) => `${item.label}: ${item.description ?? ""}`} /><ResultList title="Recommendations" items={latestAnalysis.recommendations} text={(item: any) => `${item.title}: ${item.rationale ?? ""} Expected outcome: ${item.expectedOutcome ?? ""}`} /><RiskAssumptionSections value={latestAnalysis.risks} /></div></Card> : null}</div>;
}
function ResultList({ title, items, text }: { title: string; items: any[]; text: (item: any) => string }) { return <section><h2 className="font-semibold">{title}</h2><div className="mt-2 space-y-2">{items.map((item) => <div key={item.id} className="rounded-xl border p-3"><p className="text-sm text-slate-700 dark:text-slate-200">{text(item)}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Severity/Priority: {item.severity ?? item.priority}</p></div>)}{items.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No {title.toLowerCase()} were extracted.</p> : null}</div></section>; }

function SeverityBadge({ value }: { value: unknown }) {
  const label = formatSeverityLabel(value);
  return <span className="inline-flex rounded-full border border-border bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">{label}</span>;
}

function RiskCard({ risk }: { risk: ReportRisk }) {
  return <div className="rounded-xl border border-border bg-white p-4 shadow-sm dark:bg-slate-900/60"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{risk.label}</h3><SeverityBadge value={risk.severity} /></div>{risk.description ? <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{risk.description}</p> : null}</div>;
}

function RiskAssumptionSections({ value }: { value: unknown }) {
  const { risks, assumptions } = normalizeRiskAssumptionSections(value);
  return <div className="grid gap-5 lg:grid-cols-2"><section><h2 className="font-semibold">Risks</h2><div className="mt-2 space-y-3">{risks.map((risk, index) => <RiskCard key={`${risk.label}-${index}`} risk={risk} />)}{risks.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-sm text-slate-500 dark:text-slate-400">No risks were identified in this analyzer run.</p> : null}</div></section><section><h2 className="font-semibold">Assumptions</h2><div className="mt-2 space-y-2">{assumptions.map((assumption, index) => <p key={`${assumption}-${index}`} className="rounded-xl border border-border bg-white p-3 text-sm leading-6 text-slate-700 shadow-sm dark:bg-slate-900/60 dark:text-slate-200">{assumption}</p>)}{assumptions.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-sm text-slate-500 dark:text-slate-400">No assumptions were recorded for this analyzer run.</p> : null}</div></section></div>;
}
