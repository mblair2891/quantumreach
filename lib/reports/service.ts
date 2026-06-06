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

const reportSectionDefinitions = [
  { key: "executiveSummary", title: "Executive summary" },
  { key: "currentState", title: "Current state / observed situation" },
  { key: "keyConstraints", title: "Key constraints" },
  { key: "operationalBottlenecks", title: "Operational bottlenecks" },
  { key: "strategicRecommendations", title: "Strategic recommendations" },
  { key: "risksAndAssumptions", title: "Risks and assumptions" },
  { key: "costOfInactionNarrative", title: "Cost of inaction narrative" },
  { key: "recommendedNextSteps", title: "Recommended next steps" },
  { key: "implementationRoadmapSummary", title: "Implementation roadmap summary" }
] as const;

const genericPlaceholderPattern = /review and refine|before final approval|before sending|to review|to confirm/i;

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
  if (typeof value === "string") return value.trim();
  return stringifyItem(value).trim();
}

function hasUsefulContent(value: unknown) {
  const normalized = normalizeSectionContent(value);
  return normalized.length > 0 && !genericPlaceholderPattern.test(normalized);
}

function joinSentences(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part)).join(" ");
}

function sentenceList(items: string[], fallback: string) {
  if (!items.length) return fallback;
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function bulletList(items: string[], fallback: string) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : fallback;
}

function moneyString(value: unknown) {
  const raw = typeof value === "object" && value && "toString" in value ? String(value.toString()) : typeof value === "number" || typeof value === "string" ? String(value) : "";
  if (!raw || raw === "null" || raw === "undefined") return "";
  const amount = Number(raw);
  return Number.isFinite(amount) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount) : raw;
}

function modelSummary(model: unknown, label: string) {
  if (!model || typeof model !== "object") return "";
  const record = model as Record<string, unknown>;
  const summary = normalizeSectionContent(record.executiveSummary);
  if (summary) return summary;
  const estimatedCost = moneyString(record.estimatedCost);
  const estimatedUpside = moneyString(record.estimatedUpside);
  const estimatedDelay = moneyString(record.estimatedCostOfDelay);
  const months = record.timeHorizonMonths ? `${record.timeHorizonMonths} months` : "the planning horizon";
  if (estimatedCost) return `${label} estimates ${estimatedCost} of exposure over ${months}.`;
  if (estimatedUpside || estimatedDelay) return `${label} frames ${estimatedUpside ? `${estimatedUpside} of upside` : "the upside case"}${estimatedDelay ? ` and ${estimatedDelay} in cost-of-delay exposure` : ""} over ${months}.`;
  return "";
}

function hasUsefulPhase(value: unknown) {
  if (!value || typeof value !== "object") return hasUsefulContent(value);
  const record = value as Record<string, unknown>;
  return [record.name, record.title, record.objective, record.description, record.milestones].some(hasUsefulContent);
}

function analysisLists(input: Record<string, unknown>) {
  return {
    constraints: asArray(input.constraints).map(stringifyItem).filter(Boolean),
    bottlenecks: asArray(input.bottlenecks).map(stringifyItem).filter(Boolean),
    recommendations: asArray(input.recommendations).map(stringifyItem).filter(Boolean),
    risks: asArray(input.risks).map(stringifyItem).filter(Boolean),
    assumptions: asArray(input.assumptions).map(stringifyItem).filter(Boolean)
  };
}

export function buildExecutiveReportFallback(input: Record<string, unknown>) {
  const summary = normalizeSectionContent(input.summary) || normalizeSectionContent(input.executiveNotes) || "The reviewed analysis identifies operational issues that require executive attention and a sequenced response.";
  const lists = analysisLists(input);
  const businessCase = input.businessCase && typeof input.businessCase === "object" ? input.businessCase as Record<string, unknown> : {};
  const roiSummary = modelSummary(businessCase.roi, "The ROI model");
  const costSummary = modelSummary(businessCase.costOfInaction, "The cost-of-inaction model");
  const context = input.diagnosticContext && typeof input.diagnosticContext === "object" ? input.diagnosticContext as Record<string, unknown> : {};
  const crmContext = input.crmContext && typeof input.crmContext === "object" ? input.crmContext as Record<string, unknown> : {};
  const clientName = normalizeSectionContent((crmContext.company as Record<string, unknown> | undefined)?.name) || normalizeSectionContent((crmContext.opportunity as Record<string, unknown> | undefined)?.name) || "the client";

  return {
    executiveSummary: joinSentences([summary, `The recommended response is to address ${sentenceList(lists.bottlenecks.slice(0, 2), "the highest-impact workflow bottlenecks")} while sequencing improvements around ${sentenceList(lists.constraints.slice(0, 2), "the known operating constraints")}.`, roiSummary || costSummary]),
    currentState: joinSentences([`The current state for ${clientName} shows ${summary.toLowerCase()}.`, normalizeSectionContent(context.summary) ? `Diagnostic context notes: ${normalizeSectionContent(context.summary)}` : undefined, lists.bottlenecks.length ? `Observed bottlenecks include ${sentenceList(lists.bottlenecks.slice(0, 3), "process friction")}.` : undefined]),
    keyConstraints: bulletList(lists.constraints, "No explicit constraints were captured in the reviewed analysis; validate budget, ownership, timing, and data-access constraints during review."),
    operationalBottlenecks: bulletList(lists.bottlenecks, "No explicit bottlenecks were captured in the reviewed analysis; validate handoff, follow-up, visibility, and accountability gaps during review."),
    strategicRecommendations: bulletList(lists.recommendations, "Confirm the priority operating changes with stakeholders, then define owners, milestones, and measurable success indicators."),
    risksAndAssumptions: joinSentences([lists.risks.length ? `Key risks: ${sentenceList(lists.risks, "execution risk")}.` : "Key risks should be validated during review, with particular attention to adoption, ownership, and data quality.", lists.assumptions.length ? `Working assumptions: ${sentenceList(lists.assumptions, "stakeholder alignment")}.` : "Assumptions should be confirmed before final approval."]),
    costOfInactionNarrative: joinSentences([costSummary || "If no action is taken, the organization is likely to continue absorbing avoidable leakage from slow follow-up, unclear ownership, inconsistent execution, and limited pipeline visibility.", roiSummary ? `The upside case reinforces the value of timely execution: ${roiSummary}` : undefined]),
    recommendedNextSteps: bulletList(lists.recommendations.slice(0, 3).map((item) => `Assign an owner and success measure for: ${item}`), "- Confirm executive sponsor and decision owner.\n- Validate constraints, risks, and assumptions with the client.\n- Convert the highest-priority recommendation into a 30-day action plan."),
    implementationRoadmapSummary: `Start with a 0-30 day stabilization phase focused on the most visible bottlenecks, move into a 31-60 day operating-cadence phase around constraints and ownership, and use the following 60-90 days to measure adoption, revenue impact, and process consistency.`
  };
}

export function buildExecutiveReportSections(generated: Record<string, unknown>, input: Record<string, unknown>) {
  const fallback = buildExecutiveReportFallback(input);
  return reportSectionDefinitions.map(({ key, title }) => ({ title, body: normalizeSectionContent(hasUsefulContent(generated[key]) ? generated[key] : fallback[key]) }));
}


export function buildRoadmapFallback(input: Record<string, unknown>) {
  const lists = analysisLists(input);
  const objectives = (lists.recommendations.length ? lists.recommendations : [
    "Stabilize the highest-risk operating bottlenecks",
    "Clarify ownership, follow-up cadence, and pipeline visibility",
    "Measure adoption and revenue-conversion impact"
  ]).slice(0, 4);
  return objectives.map((objective, index) => ({
    name: `Phase ${index + 1}`,
    objective,
    milestones: index === 0 ? lists.bottlenecks.slice(0, 3) : lists.recommendations.slice(index - 1, index + 2),
    dependencies: lists.constraints.slice(0, 3),
    risks: lists.risks.slice(0, 3),
    successIndicators: ["Named owner assigned", "Milestones reviewed weekly", "Revenue or workflow impact measured"],
    timeHorizon: index === 0 ? "0-30 days" : index === 1 ? "31-60 days" : index === 2 ? "61-90 days" : "90+ days"
  }));
}

function buildRoadmapSummary(input: Record<string, unknown>) {
  const lists = analysisLists(input);
  return `A phased roadmap should first stabilize ${sentenceList(lists.bottlenecks.slice(0, 2), "the most visible operational bottlenecks")}, then address ${sentenceList(lists.constraints.slice(0, 2), "the key constraints")}, and finally institutionalize the recommended operating changes with measurable success indicators.`;
}

export function buildProposalFallback(input: Record<string, unknown>, opportunity: Record<string, unknown>, roadmap: Record<string, unknown> | null) {
  const report = buildExecutiveReportFallback(input);
  const opportunityName = normalizeSectionContent(opportunity.name) || "the opportunity";
  const company = opportunity.company && typeof opportunity.company === "object" ? opportunity.company as Record<string, unknown> : null;
  const clientName = normalizeSectionContent(company?.name) || opportunityName;
  return {
    clientContext: `${clientName} is evaluating ${opportunityName}. ${report.currentState}`,
    problemStatement: report.currentState,
    recommendedSolution: report.strategicRecommendations,
    scopeOfWork: report.recommendedNextSteps,
    strategicRoadmapSummary: normalizeSectionContent(roadmap?.summary) || report.implementationRoadmapSummary,
    expectedOutcomes: "Improved ownership, stronger follow-up consistency, clearer pipeline visibility, and measurable reduction in operational leakage.",
    assumptions: report.risksAndAssumptions,
    exclusions: "PDF export, e-signature, payment processing, and external integrations are excluded from this draft unless separately scoped.",
    investmentPlaceholder: "Commercial investment should be framed against the quantified upside, cost-of-delay exposure, implementation scope, and payment terms approved by the team.",
    nextSteps: report.recommendedNextSteps
  };
}

function requireReviewedAnalysis(analysis: { status: string }) {
  if (!reviewableStatuses.includes(analysis.status as (typeof reviewableStatuses)[number])) throw new Error("Analysis must be REVIEWED or FINAL before generating deliverables.");
}

export async function listWorkspaceRecords(workspaceId: string, model: "executiveReport" | "rOIModel" | "proposal" | "implementationProject" | "knowledgeRecord" | "strategicRoadmap") {
  await requireWorkspaceAccess(workspaceId);
  return (prisma[model] as { findMany(args: unknown): Promise<unknown[]> }).findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" }, take: 50 });
}


export async function listAnalysisRecords(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId);
  return prisma.analysisRecord.findMany({
    where: { workspaceId },
    include: {
      session: {
        include: {
          analyzerRuns: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { executions: { orderBy: { createdAt: "desc" }, take: 1 } }
          }
        }
      }
    },
    orderBy: { updatedAt: "desc" },
    take: 100
  });
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
  if (existing.status === parsed) return existing;
  const now = new Date();
  const data = parsed === "REVIEWED" ? { status: parsed, reviewedById: user.id, reviewedAt: now } : parsed === "FINAL" ? { status: parsed, reviewedById: existing.reviewedById ?? user.id, reviewedAt: existing.reviewedAt ?? now, finalizedById: user.id, finalizedAt: now } : parsed === "REJECTED" ? { status: parsed, reviewedById: user.id, reviewedAt: now } : { status: parsed };
  const updated = await prisma.analysisRecord.update({ where: { id }, data });
  await audit(workspaceId, parsed === "FINAL" ? "analysis.finalized" : parsed === "REJECTED" ? "analysis.rejected" : parsed === "REVIEWED" ? "analysis.reviewed" : "analysis.status_changed", "AnalysisRecord", id, user.id, { status: parsed });
  return updated;
}

async function crmContextForSession(workspaceId: string, session?: { relatedType: string | null; relatedId: string | null } | null) {
  if (!session?.relatedType || !session.relatedId) return {};
  if (session.relatedType === "opportunity") {
    const opportunity = await prisma.opportunity.findFirst({ where: { id: session.relatedId, workspaceId }, include: { company: true, contact: true } });
    return opportunity ? { opportunity, company: opportunity.company, contact: opportunity.contact } : {};
  }
  if (session.relatedType === "company") {
    const company = await prisma.company.findFirst({ where: { id: session.relatedId, workspaceId } });
    return company ? { company } : {};
  }
  if (session.relatedType === "contact") {
    const contact = await prisma.contact.findFirst({ where: { id: session.relatedId, workspaceId }, include: { company: true } });
    return contact ? { contact, company: contact.company } : {};
  }
  if (session.relatedType === "lead") {
    const lead = await prisma.lead.findFirst({ where: { id: session.relatedId, workspaceId } });
    return lead ? { lead } : {};
  }
  return {};
}

async function sourceForAnalysis(workspaceId: string, analysisId: string) {
  const analysis = await prisma.analysisRecord.findFirst({
    where: { id: analysisId, workspaceId },
    include: {
      session: { include: { answers: { orderBy: { createdAt: "asc" }, take: 20 }, transcripts: { orderBy: { updatedAt: "desc" }, take: 3 } } },
      constraints: true,
      bottlenecks: true,
      recommendations: true,
      roiModels: { orderBy: { updatedAt: "desc" }, take: 1 },
      costOfInactionModels: { orderBy: { updatedAt: "desc" }, take: 1 }
    }
  });
  if (!analysis) notFound();
  requireReviewedAnalysis(analysis);
  const risks = riskParts(analysis.risks);
  const crmContext = await crmContextForSession(workspaceId, analysis.session);
  return {
    analysis,
    risks,
    input: {
      summary: analysis.summary,
      executiveNotes: analysis.executiveNotes,
      observations: analysis.observations,
      constraints: analysis.constraints,
      bottlenecks: analysis.bottlenecks,
      recommendations: analysis.recommendations,
      risks: risks.risks,
      assumptions: risks.assumptions,
      diagnosticContext: analysis.session ? { id: analysis.session.id, title: analysis.session.title, status: analysis.session.status, summary: analysis.session.summary, relatedType: analysis.session.relatedType, relatedId: analysis.session.relatedId, answers: analysis.session.answers, transcripts: analysis.session.transcripts } : null,
      crmContext,
      businessCase: { roi: analysis.roiModels[0] ?? null, costOfInaction: analysis.costOfInactionModels[0] ?? null }
    }
  };
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
  const generated = await generateStructured(
    workspaceId,
    user.id,
    "executive_report",
    "ExecutiveReport",
    `Create an executive-ready report from reviewed diagnostic analysis. Return valid JSON only.
The JSON object must use exactly these string fields: executiveSummary, currentState, keyConstraints, operationalBottlenecks, strategicRecommendations, risksAndAssumptions, costOfInactionNarrative, recommendedNextSteps, implementationRoadmapSummary.
Populate every field with readable business-facing draft content derived from the provided analysis, diagnostic context, CRM context, and ROI/cost-of-inaction context. Do not use placeholders. Do not finalize it.`,
    input
  );
  const fallback = buildExecutiveReportFallback(input);
  const sections = buildExecutiveReportSections(generated, input);
  const report = await prisma.executiveReport.create({ data: { workspaceId, analysisId, diagnosticSessionId: analysis.sessionId, title: `Executive report: ${analysis.title}`, sections: toPrismaJson(sections), recommendationSummary: sections.find((s) => s.title === "Strategic recommendations")?.body, roadmapSummary: sections.find((s) => s.title === "Implementation roadmap summary")?.body, status: "GENERATED", createdById: user.id } });
  await audit(workspaceId, "report.generated", "ExecutiveReport", report.id, user.id, { analysisId, fallbackSectionsUsed: sections.filter((section) => Object.values(fallback).includes(section.body)).map((section) => section.title) });
  return report;
}

export async function generateStrategicRoadmap(workspaceId: string, analysisId: string, reportId?: string) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const { analysis, input } = await sourceForAnalysis(workspaceId, analysisId);
  const generated = await generateStructured(workspaceId, user.id, "strategic_roadmap", "StrategicRoadmap", "Create a phased strategic roadmap from reviewed diagnostic analysis. Return valid JSON only with a summary string and phases array. Derive phases from recommendations, constraints, bottlenecks, risks, and assumptions. Do not use placeholders; never finalize it.", input);
  const fallbackPhases = buildRoadmapFallback(input);
  const phases = Array.isArray(generated.phases) && generated.phases.some(hasUsefulPhase) ? generated.phases : fallbackPhases;
  const summary = hasUsefulContent(generated.summary) ? normalizeSectionContent(generated.summary) : buildRoadmapSummary(input);
  const roadmap = await prisma.strategicRoadmap.create({ data: { workspaceId, analysisId, reportId, opportunityId: undefined, title: `Strategic roadmap: ${analysis.title}`, summary, phases: toPrismaJson(phases), status: "GENERATED", createdById: user.id } });
  await audit(workspaceId, "roadmap.generated", "StrategicRoadmap", roadmap.id, user.id, { analysisId, reportId, fallbackUsed: phases === fallbackPhases });
  return roadmap;
}

export async function generateProposal(workspaceId: string, opportunityId: string, analysisId: string, roadmapId?: string) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const opportunity = await prisma.opportunity.findFirst({ where: { id: opportunityId, workspaceId }, include: { company: true, contact: true } });
  if (!opportunity) notFound();
  const { analysis, input } = await sourceForAnalysis(workspaceId, analysisId);
  const roadmap = roadmapId ? await prisma.strategicRoadmap.findFirst({ where: { id: roadmapId, workspaceId } }) : null;
  if (roadmapId && !roadmap) notFound();
  const generationInput = { ...input, opportunity, roadmap };
  const generated = await generateStructured(workspaceId, user.id, "proposal_draft", "Proposal", "Create a proposal draft from an opportunity and reviewed analysis. Return valid JSON only using exactly these fields: clientContext, problemStatement, recommendedSolution, scopeOfWork, strategicRoadmapSummary, expectedOutcomes, assumptions, exclusions, investmentPlaceholder, nextSteps. Populate every field from the opportunity, analysis, and roadmap; keep it draft and do not use placeholders.", generationInput);
  const fallback = buildProposalFallback(input, opportunity as unknown as Record<string, unknown>, roadmap as Record<string, unknown> | null);
  const content = Object.fromEntries(proposalSections.map((key) => [key, normalizeSectionContent(hasUsefulContent(generated[key]) ? generated[key] : fallback[key as keyof typeof fallback])]));
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
