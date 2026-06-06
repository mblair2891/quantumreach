import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentWorkspace } from "@/lib/workspaces/service";
import { analysisFormDefaults, generateExecutiveReport, generateProposal, generateStrategicRoadmap, getAnalysisDetail, getProposalDetail, getReportDetail, getRoadmapDetail, readablePhases, readableSections, setAnalysisStatus, setDeliverableStatus, updateAnalysis, updateBusinessCase, updateProposal } from "@/lib/reports/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnalysisStatusForm, type AnalysisReviewStatus, type AnalysisStatusUpdateState } from "@/components/dashboard/analysis-status-form";

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "amber" | "green" | "red" | "blue" }) {
  const tones = { slate: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200", amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200", green: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200", red: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200", blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200" };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function statusTone(status?: string) {
  if (status === "FINAL") return "green" as const;
  if (status === "REJECTED" || status === "ARCHIVED") return "red" as const;
  if (status === "REVIEWED" || status === "GENERATED") return "blue" as const;
  if (status === "NEEDS_REVIEW" || status === "DRAFT") return "amber" as const;
  return "slate" as const;
}

function TextArea({ name, defaultValue, rows = 4 }: { name: string; defaultValue?: string | null; rows?: number }) {
  return <textarea name={name} defaultValue={defaultValue ?? ""} rows={rows} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950" />;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="text-sm leading-6 text-slate-600 dark:text-slate-300">{children}</CardContent></Card>;
}

function EventSummary({ events }: { events: Array<{ id: string; action: string; createdAt: Date }> }) {
  return <Card><CardHeader><CardTitle>Audit trail</CardTitle><CardDescription>Recent workspace-scoped workflow events.</CardDescription></CardHeader><CardContent><div className="space-y-2">{events.length ? events.map((event) => <div key={event.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"><span>{event.action}</span><span className="text-xs text-slate-500">{event.createdAt.toLocaleString()}</span></div>) : <p className="text-sm text-slate-500">No events recorded yet.</p>}</div></CardContent></Card>;
}

type BusinessCaseRecord = { estimatedUpside?: { toString(): string } | string | number | null; estimatedImplementationCost?: { toString(): string } | string | number | null; estimatedCostOfDelay?: { toString(): string } | string | number | null; confidenceScore?: number | null; estimatedCost?: { toString(): string } | string | number | null; timeHorizonMonths?: number | null; executiveSummary?: string | null };

function BusinessCaseCard({ roi, cost }: { roi?: BusinessCaseRecord | null; cost?: BusinessCaseRecord | null }) {
  return <Card><CardHeader><CardTitle>Business case</CardTitle><CardDescription>Editable ROI and cost-of-inaction assumptions.</CardDescription></CardHeader><CardContent className="grid gap-3 text-sm md:grid-cols-2"><div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"><p className="font-medium">ROI model</p><p>Estimated upside: {roi?.estimatedUpside?.toString?.() ?? "—"}</p><p>Implementation cost: {roi?.estimatedImplementationCost?.toString?.() ?? "—"}</p><p>Cost of delay: {roi?.estimatedCostOfDelay?.toString?.() ?? "—"}</p><p>Confidence: {roi?.confidenceScore ?? "—"}%</p></div><div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"><p className="font-medium">Cost of inaction</p><p>Estimated cost: {cost?.estimatedCost?.toString?.() ?? "—"}</p><p>Time horizon: {cost?.timeHorizonMonths ?? "—"} months</p><p>Confidence: {cost?.confidenceScore ?? "—"}%</p></div></CardContent></Card>;
}

async function workspaceId() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) redirect("/onboarding");
  return workspace.id;
}

export async function AnalysisDetailPage({ id }: { id: string }) {
  const wid = await workspaceId();
  const { analysis, events } = await getAnalysisDetail(wid, id);
  const defaults = analysisFormDefaults(analysis);
  async function save(formData: FormData) { "use server"; const wid = await workspaceId(); await updateAnalysis(wid, id, Object.fromEntries(formData)); revalidatePath(`/dashboard/analysis/${id}`); }
  async function updateStatus(_state: AnalysisStatusUpdateState, formData: FormData): Promise<AnalysisStatusUpdateState> { "use server"; const nextStatus = formData.get("status") as AnalysisReviewStatus | null; try { const wid = await workspaceId(); const updated = await setAnalysisStatus(wid, id, nextStatus); revalidatePath(`/dashboard/analysis/${id}`); return { message: "Status updated successfully.", savedStatus: updated.status as AnalysisReviewStatus }; } catch { return { error: "We couldn’t update the review status. Please try again.", savedStatus: analysis.status as AnalysisReviewStatus }; } }
  async function report() { "use server"; const wid = await workspaceId(); const created = await generateExecutiveReport(wid, id); redirect(`/dashboard/reports/${created.id}`); }
  async function roadmap() { "use server"; const wid = await workspaceId(); const created = await generateStrategicRoadmap(wid, id); redirect(`/dashboard/roadmaps/${created.id}`); }
  async function proposal(formData: FormData) { "use server"; const wid = await workspaceId(); const created = await generateProposal(wid, String(formData.get("opportunityId") ?? ""), id); redirect(`/dashboard/proposals/${created.id}`); }
  async function business(formData: FormData) { "use server"; const wid = await workspaceId(); await updateBusinessCase(wid, id, Object.fromEntries(formData)); revalidatePath(`/dashboard/analysis/${id}`); }
  const roi = analysis.roiModels[0]; const cost = analysis.costOfInactionModels[0];
  return <div className="space-y-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-slate-500">Analysis review workflow</p><h1 className="text-3xl font-semibold">{analysis.title}</h1><p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">AI output remains draft intelligence until explicitly reviewed and finalized by a workspace member.</p></div><Badge tone={statusTone(analysis.status)}>{analysis.status}</Badge></div><BusinessCaseCard roi={roi} cost={cost} /><div className="grid gap-6 lg:grid-cols-[2fr_1fr]"><form action={save} className="space-y-4"><SectionCard title="Diagnostic summary"><TextArea name="summary" defaultValue={analysis.summary} rows={5} /></SectionCard><SectionCard title="Constraints"><TextArea name="constraints" defaultValue={defaults.constraints} /></SectionCard><SectionCard title="Bottlenecks"><TextArea name="bottlenecks" defaultValue={defaults.bottlenecks} /></SectionCard><SectionCard title="Recommendations"><TextArea name="recommendations" defaultValue={defaults.recommendations} /></SectionCard><SectionCard title="Risks"><TextArea name="risks" defaultValue={defaults.risks} /></SectionCard><SectionCard title="Assumptions"><TextArea name="assumptions" defaultValue={defaults.assumptions} /></SectionCard><SectionCard title="Executive notes"><TextArea name="executiveNotes" defaultValue={analysis.executiveNotes} /></SectionCard><SectionCard title="Internal notes"><TextArea name="internalNotes" defaultValue={analysis.internalNotes} /></SectionCard><Button type="submit">Save reviewed edits</Button></form><div className="space-y-4"><AnalysisStatusForm currentStatus={analysis.status as AnalysisReviewStatus} action={updateStatus} /><Card><CardHeader><CardTitle>Generate deliverables</CardTitle><CardDescription>Generation never finalizes outputs automatically.</CardDescription></CardHeader><CardContent className="space-y-3"><form action={report}><Button type="submit" className="w-full">Generate executive report</Button></form><form action={roadmap}><Button type="submit" className="w-full" variant="outline">Generate roadmap</Button></form><form action={proposal} className="space-y-2"><Input name="opportunityId" placeholder="Opportunity ID" /><Button type="submit" className="w-full" variant="outline">Generate proposal draft</Button></form></CardContent></Card><form action={business} className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800"><h2 className="font-semibold">Edit business case</h2><Input name="estimatedUpside" placeholder="Estimated upside" defaultValue={roi?.estimatedUpside?.toString?.()} /><Input name="estimatedImplementationCost" placeholder="Implementation cost" defaultValue={roi?.estimatedImplementationCost?.toString?.()} /><Input name="estimatedCostOfDelay" placeholder="Cost of delay" defaultValue={roi?.estimatedCostOfDelay?.toString?.()} /><Input name="roiTimeHorizonMonths" placeholder="ROI horizon months" defaultValue={roi?.timeHorizonMonths ?? undefined} /><Input name="roiConfidenceScore" placeholder="ROI confidence 0-100" defaultValue={roi?.confidenceScore ?? undefined} /><Input name="costOfInaction" placeholder="Cost of inaction" defaultValue={cost?.estimatedCost?.toString?.()} /><Input name="costTimeHorizonMonths" placeholder="Cost horizon months" defaultValue={cost?.timeHorizonMonths ?? undefined} /><Input name="costConfidenceScore" placeholder="Cost confidence 0-100" defaultValue={cost?.confidenceScore ?? undefined} /><TextArea name="assumptions" defaultValue="" rows={3} /><TextArea name="executiveSummary" defaultValue={roi?.executiveSummary ?? cost?.executiveSummary} rows={3} /><Button type="submit" variant="outline">Save business case</Button></form><EventSummary events={events} /></div></div></div>;
}

export async function ReportDetailPage({ id }: { id: string }) {
  const wid = await workspaceId(); const { report, events } = await getReportDetail(wid, id);
  async function status(formData: FormData) { "use server"; const wid = await workspaceId(); await setDeliverableStatus(wid, "report", id, formData.get("status")); revalidatePath(`/dashboard/reports/${id}`); }
  return <DeliverableFrame title={report.title} label="Executive report" status={report.status} events={events} analysisId={report.analysisId} roi={report.analysis?.roiModels[0]} cost={report.analysis?.costOfInactionModels[0]} statusAction={status}>{readableSections(report.sections).map((section) => <SectionCard key={section.title} title={section.title}><p className="whitespace-pre-wrap">{section.body}</p></SectionCard>)}</DeliverableFrame>;
}

export async function RoadmapDetailPage({ id }: { id: string }) {
  const wid = await workspaceId(); const { roadmap, events } = await getRoadmapDetail(wid, id);
  async function status(formData: FormData) { "use server"; const wid = await workspaceId(); await setDeliverableStatus(wid, "roadmap", id, formData.get("status")); revalidatePath(`/dashboard/roadmaps/${id}`); }
  return <DeliverableFrame title={roadmap.title} label="Strategic roadmap" status={roadmap.status} events={events} analysisId={roadmap.analysisId} roi={roadmap.analysis?.roiModels[0]} cost={roadmap.analysis?.costOfInactionModels[0]} statusAction={status}>{roadmap.summary && <SectionCard title="Roadmap summary"><p>{roadmap.summary}</p></SectionCard>}<div className="grid gap-4 md:grid-cols-2">{readablePhases(roadmap.phases).map((phase, index) => <Card key={index}><CardHeader><CardTitle>{String(phase.name ?? phase.title ?? `Phase ${index + 1}`)}</CardTitle><CardDescription>{String(phase.timeHorizon ?? phase.horizon ?? "Time horizon to confirm")}</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><p>{String(phase.objective ?? phase.description ?? "Objective to review")}</p><p><strong>Milestones:</strong> {normalizeList(phase.milestones)}</p><p><strong>Dependencies:</strong> {normalizeList(phase.dependencies)}</p><p><strong>Risks:</strong> {normalizeList(phase.risks)}</p><p><strong>Success indicators:</strong> {normalizeList(phase.successIndicators ?? phase.success_indicators)}</p></CardContent></Card>)}</div></DeliverableFrame>;
}

export async function ProposalDetailPage({ id }: { id: string }) {
  const wid = await workspaceId(); const { proposal, events } = await getProposalDetail(wid, id);
  async function status(formData: FormData) { "use server"; const wid = await workspaceId(); await setDeliverableStatus(wid, "proposal", id, formData.get("status")); revalidatePath(`/dashboard/proposals/${id}`); }
  async function save(formData: FormData) { "use server"; const wid = await workspaceId(); await updateProposal(wid, id, Object.fromEntries(formData)); revalidatePath(`/dashboard/proposals/${id}`); }
  const sections = readableSections(proposal.content);
  return <DeliverableFrame title={proposal.title} label="Proposal draft" status={proposal.status} events={events} analysisId={proposal.analysisId} roi={proposal.analysis?.roiModels[0]} cost={proposal.analysis?.costOfInactionModels[0]} statusAction={status}><Card><CardHeader><CardTitle>Linked opportunity</CardTitle><CardDescription>{proposal.opportunity?.name ?? "No opportunity context"}{proposal.opportunity?.company ? ` · ${proposal.opportunity.company.name}` : ""}</CardDescription></CardHeader></Card><form action={save} className="space-y-4">{sections.map((section) => <SectionCard key={section.title} title={labelize(section.title)}><TextArea name={section.title} defaultValue={section.body} rows={4} /></SectionCard>)}<Button type="submit">Save proposal edits</Button></form></DeliverableFrame>;
}

function DeliverableFrame({ title, label, status, events, children, analysisId, roi, cost, statusAction }: { title: string; label: string; status: string; events: Array<{ id: string; action: string; createdAt: Date }>; children: React.ReactNode; analysisId?: string | null; roi?: BusinessCaseRecord | null; cost?: BusinessCaseRecord | null; statusAction: (formData: FormData) => Promise<void> }) {
  return <div className="space-y-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-slate-500">{label}</p><h1 className="text-3xl font-semibold">{title}</h1>{analysisId && <Link className="mt-2 inline-block text-sm text-blue-600" href={`/dashboard/analysis/${analysisId}`}>View source analysis</Link>}</div><Badge tone={statusTone(status)}>{status}</Badge></div><BusinessCaseCard roi={roi} cost={cost} /><div className="grid gap-6 lg:grid-cols-[2fr_1fr]"><div className="space-y-4">{children}</div><div className="space-y-4"><Card><CardHeader><CardTitle>Deliverable actions</CardTitle><CardDescription>Manual review and finalization controls.</CardDescription></CardHeader><CardContent className="space-y-3"><form action={statusAction}><input type="hidden" name="status" value="REVIEWED" /><Button type="submit" variant="outline">Mark reviewed</Button></form><form action={statusAction}><input type="hidden" name="status" value="FINAL" /><Button type="submit">Mark final</Button></form><form action={statusAction}><input type="hidden" name="status" value="ARCHIVED" /><Button type="submit" variant="outline">Archive</Button></form></CardContent></Card><EventSummary events={events} /></div></div></div>;
}

function normalizeList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => typeof item === "string" ? item : JSON.stringify(item)).join(", ") || "—";
  return typeof value === "string" ? value : "—";
}

function labelize(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

export function DetailPage({ type, id }: { type: string; id: string }) {
  return <div className="space-y-6"><div><p className="text-sm text-slate-500">{type} detail</p><h1 className="text-3xl font-semibold">Record {id}</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Workspace-scoped detail route foundation.</p></div></div>;
}
