import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit/service";
import { toPrismaJson } from "@/lib/db/json";
import { getAIProvider } from "@/lib/ai/provider";

const reviewableStatuses = ["REVIEWED", "FINAL"] as const;
const reportStatus = z.enum(["DRAFT", "GENERATED", "REVIEWED", "FINAL", "ARCHIVED"]);
const reviewStatus = z.enum(["DRAFT", "NEEDS_REVIEW", "REVIEWED", "FINAL", "REJECTED"]);

const text = z.string().trim().optional().or(z.literal(""));
const money = z.coerce.number().nonnegative().optional().or(z.literal(""));
const confidence = z.coerce.number().int().min(0).max(100).optional().or(z.literal(""));
const months = z.coerce.number().int().min(1).max(120).optional().or(z.literal(""));

export const analysisEditSchema = z.object({
  summary: z.string().trim().min(1),
  constraints: z.string().optional().default(""),
  bottlenecks: z.string().optional().default(""),
  recommendations: z.string().optional().default(""),
  risks: z.string().optional().default(""),
  assumptions: z.string().optional().default(""),
  executiveNotes: text,
  internalNotes: text
});

export const businessCaseSchema = z.object({
  estimatedUpside: money,
  estimatedImplementationCost: money,
  estimatedCostOfDelay: money,
  roiTimeHorizonMonths: months,
  roiConfidenceScore: confidence,
  costOfInaction: money,
  costTimeHorizonMonths: months,
  costConfidenceScore: confidence,
  assumptions: z.string().optional().default(""),
  executiveSummary: text
});

export const proposalEditSchema = z.object({
  clientContext: z.string().optional().default(""),
  problemStatement: z.string().optional().default(""),
  recommendedSolution: z.string().optional().default(""),
  scopeOfWork: z.string().optional().default(""),
  strategicRoadmapSummary: z.string().optional().default(""),
  expectedOutcomes: z.string().optional().default(""),
  assumptions: z.string().optional().default(""),
  exclusions: z.string().optional().default(""),
  investmentPlaceholder: z.string().optional().default(""),
  nextSteps: z.string().optional().default("")
});

const reportSections = [
  "Executive summary",
  "Current state / observed situation",
  "Key constraints",
  "Operational bottlenecks",
  "Strategic recommendations",
  "Risks and assumptions",
  "Cost of inaction narrative",
  "Recommended next steps",
  "Implementation roadmap summary"
];

const proposalSections = ["clientContext", "problemStatement", "recommendedSolution", "scopeOfWork", "strategicRoadmapSummary", "expectedOutcomes", "assumptions", "exclusions", "investmentPlaceholder", "nextSteps"];

function linesToItems(value?: string) {
  return (value ?? "").split("\n").map((line) => line.replace(/^[-*]\s*/, "").trim()).filter(Boolean);
}

function toDecimal(value: number | "" | undefined) {
  return typeof value === "number" ? value : undefined;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function riskParts(risks: unknown) {
  if (risks && typeof risks === "object" && !Array.isArray(risks)) {
    const record = risks as Record<string, unknown>;
    return { risks: asArray(record.risks), assumptions: asArray(record.assumptions) };
  }
  return { risks: asArray(risks), assumptions: [] };
}

function stringifyItem(item: unknown) {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return String(item ?? "");
  const record = item as Record<string, unknown>;
  return [record.label, record.title, record.description, record.impact, record.rationale, record.expectedOutcome, record.evidence].filter(Boolean).join(" — ");
}

function normalizeSectionContent(value: unknown) {
  if (Array.isArray(value)) return value.map(stringifyItem).filter(Boolean).join("\n");
  if (typeof value === "string") return value;
  return stringifyItem(value);
}

function makeSections(names: string[], source: Record<string, unknown>) {
  return names.map((title) => {
    const key = title.toLowerCase().replace(/[^a-z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase()).replace(/[^a-z0-9]/g, "");
    return { title, body: normalizeSectionContent(source[key] ?? source[title] ?? source[title.toLowerCase()] ?? "Review and refine this section before final approval.") };
  });
}

function requireReviewedAnalysis(analysis: { status: string }) {
  if (!reviewableStatuses.includes(analysis.status as (typeof reviewableStatuses)[number])) throw new Error("Analysis must be REVIEWED or FINAL before generating deliverables.");
}

export async function listWorkspaceRecords(workspaceId: string, model: "executiveReport" | "rOIModel" | "proposal" | "implementationProject" | "knowledgeRecord" | "strategicRoadmap") {
  await requireWorkspaceAccess(workspaceId);
  return (prisma[model] as { findMany(args: unknown): Promise<unknown[]> }).findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" }, take: 50 });
}

export async function getAnalysisDetail(workspaceId: string, id: string) {
  await requireWorkspaceAccess(workspaceId);
  const analysis = await prisma.analysisRecord.findFirst({ where: { id, workspaceId }, include: { session: true, constraints: true, bottlenecks: true, recommendations: true, reports: { orderBy: { updatedAt: "desc" } }, roadmaps: { orderBy: { updatedAt: "desc" } }, proposals: { orderBy: { updatedAt: "desc" } }, roiModels: { orderBy: { updatedAt: "desc" }, take: 1 }, costOfInactionModels: { orderBy: { updatedAt: "desc" }, take: 1 } } });
  if (!analysis) notFound();
  const events = await prisma.auditLog.findMany({ where: { workspaceId, entityId: id }, orderBy: { createdAt: "desc" }, take: 12 });
  return { analysis, events };
}

export async function updateAnalysis(workspaceId: string, id: string, input: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const data = analysisEditSchema.parse(input);
  const existing = await prisma.analysisRecord.findFirst({ where: { id, workspaceId } });
  if (!existing) notFound();
  const risks = linesToItems(data.risks);
  const assumptions = linesToItems(data.assumptions);
  const updated = await prisma.$transaction(async (tx) => {
    const analysis = await tx.analysisRecord.update({ where: { id }, data: { summary: data.summary, executiveNotes: data.executiveNotes || null, internalNotes: data.internalNotes || null, risks: toPrismaJson({ risks, assumptions }), observations: toPrismaJson({ ...(typeof existing.observations === "object" && existing.observations ? existing.observations as object : {}), summary: data.summary, risks, assumptions, humanEditedAt: new Date().toISOString() }) } });
    await tx.constraint.deleteMany({ where: { workspaceId, analysisId: id } });
    await tx.bottleneck.deleteMany({ where: { workspaceId, analysisId: id } });
    await tx.recommendation.deleteMany({ where: { workspaceId, analysisId: id } });
    await tx.constraint.createMany({ data: linesToItems(data.constraints).map((label) => ({ workspaceId, analysisId: id, label, severity: "MEDIUM" })) });
    await tx.bottleneck.createMany({ data: linesToItems(data.bottlenecks).map((label) => ({ workspaceId, analysisId: id, label, severity: "MEDIUM" })) });
    await tx.recommendation.createMany({ data: linesToItems(data.recommendations).map((title) => ({ workspaceId, analysisId: id, title, priority: "MEDIUM", reviewStatus: analysis.status === "FINAL" ? "FINAL" : "REVIEWED" })) });
    return analysis;
  });
  await audit(workspaceId, "analysis.edited", "AnalysisRecord", id, user.id, { sections: ["summary", "constraints", "bottlenecks", "recommendations", "risks", "assumptions", "executiveNotes", "internalNotes"] });
  return updated;
}

export async function setAnalysisStatus(workspaceId: string, id: string, status: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const parsed = reviewStatus.parse(status);
  const existing = await prisma.analysisRecord.findFirst({ where: { id, workspaceId } });
  if (!existing) notFound();
  const now = new Date();
  const data = parsed === "REVIEWED" ? { status: parsed, reviewedById: user.id, reviewedAt: now } : parsed === "FINAL" ? { status: parsed, reviewedById: existing.reviewedById ?? user.id, reviewedAt: existing.reviewedAt ?? now, finalizedById: user.id, finalizedAt: now } : parsed === "REJECTED" ? { status: parsed, reviewedById: user.id, reviewedAt: now } : { status: parsed };
  const updated = await prisma.analysisRecord.update({ where: { id }, data });
  await audit(workspaceId, parsed === "FINAL" ? "analysis.finalized" : parsed === "REJECTED" ? "analysis.rejected" : parsed === "REVIEWED" ? "analysis.reviewed" : "analysis.status_changed", "AnalysisRecord", id, user.id, { status: parsed });
  return updated;
}

async function sourceForAnalysis(workspaceId: string, analysisId: string) {
  const analysis = await prisma.analysisRecord.findFirst({ where: { id: analysisId, workspaceId }, include: { session: true, constraints: true, bottlenecks: true, recommendations: true, roiModels: { orderBy: { updatedAt: "desc" }, take: 1 }, costOfInactionModels: { orderBy: { updatedAt: "desc" }, take: 1 } } });
  if (!analysis) notFound();
  requireReviewedAnalysis(analysis);
  const risks = riskParts(analysis.risks);
  return { analysis, risks, input: { summary: analysis.summary, executiveNotes: analysis.executiveNotes, constraints: analysis.constraints, bottlenecks: analysis.bottlenecks, recommendations: analysis.recommendations, risks: risks.risks, assumptions: risks.assumptions, businessCase: { roi: analysis.roiModels[0] ?? null, costOfInaction: analysis.costOfInactionModels[0] ?? null } } };
}

async function generateStructured(workspaceId: string, actorId: string, kind: string, schemaName: string, system: string, input: Record<string, unknown>) {
  const aiInput = toPrismaJson(input);
  const execution = await prisma.aIExecution.create({ data: { workspaceId, provider: "openai", model: process.env.OPENAI_DEFAULT_MODEL ?? "gpt-4.1-mini", input: aiInput, status: "RUNNING", startedAt: new Date(), createdById: actorId } });
  try {
    const result = await getAIProvider().runStructured({ system, user: JSON.stringify(input), schemaName });
    await prisma.aIExecution.update({ where: { id: execution.id }, data: { status: result.parseError ? "FAILED" : "SUCCEEDED", model: result.model, output: toPrismaJson({ structured: result.json, raw: result.rawText, parseError: result.parseError }), error: result.parseError ?? null, completedAt: new Date() } });
    await prisma.aIOutputArtifact.create({ data: { workspaceId, aiExecutionId: execution.id, artifactType: kind, content: toPrismaJson({ structured: result.json, raw: result.rawText, parseError: result.parseError }), reviewStatus: "NEEDS_REVIEW", createdById: actorId } });
    return result.json && typeof result.json === "object" ? result.json as Record<string, unknown> : {};
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI generation failed";
    await prisma.aIExecution.update({ where: { id: execution.id }, data: { status: "FAILED", error: message, completedAt: new Date() } });
    await prisma.aIOutputArtifact.create({ data: { workspaceId, aiExecutionId: execution.id, artifactType: kind, content: toPrismaJson({ error: message, fallbackUsed: true }), reviewStatus: "NEEDS_REVIEW", createdById: actorId } });
    return {};
  }
}

export async function generateExecutiveReport(workspaceId: string, analysisId: string) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const { analysis, input } = await sourceForAnalysis(workspaceId, analysisId);
  const generated = await generateStructured(workspaceId, user.id, "executive_report", "ExecutiveReport", "Create an executive-ready report from reviewed diagnostic analysis. Return JSON sections only; never finalize it.", input);
  const sections = makeSections(reportSections, generated);
  const report = await prisma.executiveReport.create({ data: { workspaceId, analysisId, diagnosticSessionId: analysis.sessionId, title: `Executive report: ${analysis.title}`, sections: toPrismaJson(sections), recommendationSummary: sections.find((s) => s.title === "Strategic recommendations")?.body, roadmapSummary: sections.find((s) => s.title === "Implementation roadmap summary")?.body, status: "GENERATED", createdById: user.id } });
  await audit(workspaceId, "report.generated", "ExecutiveReport", report.id, user.id, { analysisId });
  return report;
}

export async function generateStrategicRoadmap(workspaceId: string, analysisId: string, reportId?: string) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const { analysis, input } = await sourceForAnalysis(workspaceId, analysisId);
  const generated = await generateStructured(workspaceId, user.id, "strategic_roadmap", "StrategicRoadmap", "Create a phased strategic roadmap from reviewed diagnostic analysis. Return JSON with phases; never finalize it.", input);
  const phases = Array.isArray(generated.phases) && generated.phases.length ? generated.phases : ["Stabilize follow-up process", "Improve pipeline visibility", "Implement accountability workflow", "Measure revenue conversion lift"].map((objective, index) => ({ name: `Phase ${index + 1}`, objective, milestones: [], dependencies: [], risks: [], successIndicators: [], timeHorizon: index === 0 ? "0-30 days" : index === 1 ? "31-60 days" : index === 2 ? "61-90 days" : "90+ days" }));
  const roadmap = await prisma.strategicRoadmap.create({ data: { workspaceId, analysisId, reportId, opportunityId: undefined, title: `Strategic roadmap: ${analysis.title}`, summary: typeof generated.summary === "string" ? generated.summary : "Phased implementation sequence for the reviewed analysis.", phases: toPrismaJson(phases), status: "GENERATED", createdById: user.id } });
  await audit(workspaceId, "roadmap.generated", "StrategicRoadmap", roadmap.id, user.id, { analysisId, reportId });
  return roadmap;
}

export async function generateProposal(workspaceId: string, opportunityId: string, analysisId: string, roadmapId?: string) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const opportunity = await prisma.opportunity.findFirst({ where: { id: opportunityId, workspaceId }, include: { company: true, contact: true } });
  if (!opportunity) notFound();
  const { analysis, input } = await sourceForAnalysis(workspaceId, analysisId);
  const roadmap = roadmapId ? await prisma.strategicRoadmap.findFirst({ where: { id: roadmapId, workspaceId } }) : null;
  if (roadmapId && !roadmap) notFound();
  const generated = await generateStructured(workspaceId, user.id, "proposal_draft", "Proposal", "Create a proposal draft from an opportunity and reviewed analysis. Return JSON sections only; keep it draft.", { ...input, opportunity, roadmap });
  const content = Object.fromEntries(proposalSections.map((key) => [key, normalizeSectionContent(generated[key] ?? "Review and refine before sending.")]));
  const proposal = await prisma.proposal.create({ data: { workspaceId, opportunityId, analysisId: analysis.id, roadmapId: roadmap?.id, companyId: opportunity.companyId, title: `Proposal draft: ${opportunity.name}`, content: toPrismaJson(content), status: "DRAFT", createdById: user.id } });
  await audit(workspaceId, "proposal.generated", "Proposal", proposal.id, user.id, { opportunityId, analysisId, roadmapId: roadmap?.id });
  return proposal;
}

export async function updateProposal(workspaceId: string, id: string, input: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const existing = await prisma.proposal.findFirst({ where: { id, workspaceId } });
  if (!existing) notFound();
  const data = proposalEditSchema.parse(input);
  const proposal = await prisma.proposal.update({ where: { id }, data: { content: toPrismaJson(data) } });
  await audit(workspaceId, "proposal.edited", "Proposal", id, user.id, { sections: proposalSections });
  return proposal;
}

export async function updateBusinessCase(workspaceId: string, analysisId: string, input: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const analysis = await prisma.analysisRecord.findFirst({ where: { id: analysisId, workspaceId } });
  if (!analysis) notFound();
  const data = businessCaseSchema.parse(input);
  const assumptions = toPrismaJson({ keyAssumptions: linesToItems(data.assumptions), reviewedBy: user.id, reviewedAt: new Date().toISOString() });
  const roi = await prisma.rOIModel.upsert({ where: { id: (await prisma.rOIModel.findFirst({ where: { workspaceId, analysisId }, select: { id: true } }))?.id ?? "missing" }, update: { assumptions, estimatedUpside: toDecimal(data.estimatedUpside), estimatedImplementationCost: toDecimal(data.estimatedImplementationCost), estimatedCostOfDelay: toDecimal(data.estimatedCostOfDelay), timeHorizonMonths: toDecimal(data.roiTimeHorizonMonths), confidenceScore: toDecimal(data.roiConfidenceScore), executiveSummary: data.executiveSummary || null }, create: { workspaceId, analysisId, title: `ROI model: ${analysis.title}`, assumptions, estimatedUpside: toDecimal(data.estimatedUpside), estimatedImplementationCost: toDecimal(data.estimatedImplementationCost), estimatedCostOfDelay: toDecimal(data.estimatedCostOfDelay), timeHorizonMonths: toDecimal(data.roiTimeHorizonMonths), confidenceScore: toDecimal(data.roiConfidenceScore), executiveSummary: data.executiveSummary || null, createdById: user.id } });
  const coiExisting = await prisma.costOfInactionModel.findFirst({ where: { workspaceId, analysisId }, select: { id: true } });
  const coi = coiExisting ? await prisma.costOfInactionModel.update({ where: { id: coiExisting.id }, data: { assumptions, estimatedCost: toDecimal(data.costOfInaction), timeHorizonMonths: toDecimal(data.costTimeHorizonMonths), confidenceScore: toDecimal(data.costConfidenceScore), executiveSummary: data.executiveSummary || null } }) : await prisma.costOfInactionModel.create({ data: { workspaceId, analysisId, title: `Cost of inaction: ${analysis.title}`, assumptions, estimatedCost: toDecimal(data.costOfInaction), timeHorizonMonths: toDecimal(data.costTimeHorizonMonths), confidenceScore: toDecimal(data.costConfidenceScore), executiveSummary: data.executiveSummary || null, createdById: user.id } });
  await audit(workspaceId, "roi_model.edited", "ROIModel", roi.id, user.id, { analysisId });
  await audit(workspaceId, "cost_of_inaction_model.edited", "CostOfInactionModel", coi.id, user.id, { analysisId });
  return { roi, coi };
}

export async function setDeliverableStatus(workspaceId: string, type: "report" | "roadmap" | "proposal", id: string, status: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const parsed = reportStatus.parse(status);
  const model = type === "report" ? prisma.executiveReport : type === "roadmap" ? prisma.strategicRoadmap : prisma.proposal;
  const existing = await (model as { findFirst(args: unknown): Promise<{ id: string; workspaceId: string; reviewedById?: string | null; reviewedAt?: Date | null } | null> }).findFirst({ where: { id, workspaceId } });
  if (!existing) notFound();
  const now = new Date();
  const data = parsed === "REVIEWED" ? { status: parsed, reviewedById: user.id, reviewedAt: now } : parsed === "FINAL" ? { status: parsed, reviewedById: existing.reviewedById ?? user.id, reviewedAt: existing.reviewedAt ?? now, finalizedById: user.id, finalizedAt: now } : { status: parsed };
  const updated = await (model as { update(args: unknown): Promise<unknown> }).update({ where: { id }, data });
  await audit(workspaceId, `${type}.${parsed === "FINAL" ? "finalized" : parsed === "REVIEWED" ? "reviewed" : parsed === "ARCHIVED" ? "archived" : "status_changed"}`, type === "report" ? "ExecutiveReport" : type === "roadmap" ? "StrategicRoadmap" : "Proposal", id, user.id, { status: parsed });
  return updated;
}

export async function getReportDetail(workspaceId: string, id: string) {
  await requireWorkspaceAccess(workspaceId);
  const report = await prisma.executiveReport.findFirst({ where: { id, workspaceId }, include: { analysis: { include: { roiModels: { orderBy: { updatedAt: "desc" }, take: 1 }, costOfInactionModels: { orderBy: { updatedAt: "desc" }, take: 1 } } } } });
  if (!report) notFound();
  const events = await prisma.auditLog.findMany({ where: { workspaceId, entityId: id }, orderBy: { createdAt: "desc" }, take: 12 });
  return { report, events };
}

export async function getRoadmapDetail(workspaceId: string, id: string) {
  await requireWorkspaceAccess(workspaceId);
  const roadmap = await prisma.strategicRoadmap.findFirst({ where: { id, workspaceId }, include: { analysis: { include: { roiModels: { orderBy: { updatedAt: "desc" }, take: 1 }, costOfInactionModels: { orderBy: { updatedAt: "desc" }, take: 1 } } }, proposals: true } });
  if (!roadmap) notFound();
  const events = await prisma.auditLog.findMany({ where: { workspaceId, entityId: id }, orderBy: { createdAt: "desc" }, take: 12 });
  return { roadmap, events };
}

export async function getProposalDetail(workspaceId: string, id: string) {
  await requireWorkspaceAccess(workspaceId);
  const proposal = await prisma.proposal.findFirst({ where: { id, workspaceId }, include: { opportunity: { include: { company: true, contact: true } }, roadmap: true, analysis: { include: { roiModels: { orderBy: { updatedAt: "desc" }, take: 1 }, costOfInactionModels: { orderBy: { updatedAt: "desc" }, take: 1 } } } } });
  if (!proposal) notFound();
  const events = await prisma.auditLog.findMany({ where: { workspaceId, entityId: id }, orderBy: { createdAt: "desc" }, take: 12 });
  return { proposal, events };
}

export function analysisFormDefaults(analysis: Awaited<ReturnType<typeof getAnalysisDetail>>["analysis"]) {
  const risks = riskParts(analysis.risks);
  return { risks: risks.risks.map(stringifyItem).join("\n"), assumptions: risks.assumptions.map(stringifyItem).join("\n"), constraints: analysis.constraints.map((item) => item.label ?? "").join("\n"), bottlenecks: analysis.bottlenecks.map((item) => item.label ?? "").join("\n"), recommendations: analysis.recommendations.map((item) => item.title ?? "").join("\n") };
}

export function readableSections(value: unknown): Array<{ title: string; body: string }> {
  if (Array.isArray(value)) return value.map((item, index) => ({ title: String((item as Record<string, unknown>)?.title ?? (item as Record<string, unknown>)?.name ?? `Section ${index + 1}`), body: normalizeSectionContent((item as Record<string, unknown>)?.body ?? (item as Record<string, unknown>)?.content ?? item) }));
  if (value && typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([title, body]) => ({ title, body: normalizeSectionContent(body) }));
  return [];
}

export function readablePhases(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
}
