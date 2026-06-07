import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import type { KnowledgeAuthorityLevel, KnowledgePriority, WorkflowStage } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit/service";
import { toPrismaJson } from "@/lib/db/json";
import { TXT_IMPORT_MAX_FILES } from "@/lib/knowledge/import";

export const knowledgeAuthorityLevels = ["SYSTEM_DOCTRINE", "PRODUCT_DOCTRINE", "UX_COPY_DOCTRINE", "STRATEGY_FRAMEWORK", "DIAGNOSTIC_FRAMEWORK", "ROI_FRAMEWORK", "REPORT_FRAMEWORK", "ROADMAP_FRAMEWORK", "PROPOSAL_FRAMEWORK", "EXECUTION_HANDOFF", "AUTHORITY_TEMPLATE", "TRAINING_CURRICULUM", "COURSE_TEMPLATE", "REFERENCE"] as const;
export const knowledgePriorities = ["GLOBAL", "HIGH", "MEDIUM", "LOW"] as const;
export const knowledgeStatuses = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export const workflowStages = ["LEAD_CAPTURE", "OUTREACH", "DISCOVERY_CALL", "TRANSCRIPT_ANALYSIS", "DIAGNOSTIC_REVIEW", "REPORT_GENERATION", "ROADMAP_GENERATION", "PROPOSAL_GENERATION", "ROI_MODELING", "IMPLEMENTATION_HANDOFF", "AUTHORITY_ASSET_GENERATION", "ACADEMY_TRAINING", "APP_UX", "OFFER_CREATION", "POSITIONING"] as const;

const optionalText = z.string().trim().optional().or(z.literal(""));
export const knowledgeDocumentSchema = z.object({
  title: z.string().trim().min(2),
  description: optionalText,
  documentType: z.enum(knowledgeAuthorityLevels),
  authorityLevel: z.enum(knowledgeAuthorityLevels),
  priority: z.enum(knowledgePriorities).default("MEDIUM"),
  workflowStages: z.union([z.array(z.enum(workflowStages)), z.string(), z.null()]).default([]),
  offerLine: optionalText,
  audience: optionalText,
  industry: optionalText,
  tags: optionalText,
  status: z.enum(knowledgeStatuses).default("DRAFT"),
  version: z.string().trim().default("1.0"),
  sourceFileName: optionalText,
  sourceMimeType: optionalText,
  sourceText: z.string().trim().min(10)
});


export const bulkKnowledgeImportSchema = z.object({
  documents: z.array(knowledgeDocumentSchema.extend({
    clientId: z.string().trim().optional()
  })).min(1).max(TXT_IMPORT_MAX_FILES)
});

export const initialKnowledgeManifest = [
  { title: "Master System Operating Doctrine", documentType: "SYSTEM_DOCTRINE", authorityLevel: "SYSTEM_DOCTRINE", priority: "GLOBAL", workflowStages: ["DISCOVERY_CALL", "TRANSCRIPT_ANALYSIS", "DIAGNOSTIC_REVIEW", "REPORT_GENERATION", "ROADMAP_GENERATION", "PROPOSAL_GENERATION", "IMPLEMENTATION_HANDOFF"], useFor: "global AI behavior, analyzer logic, report/proposal tone, compliance and risk discipline, mandatory narrative arc" },
  { title: "Master System Rollout Directive — Best-in-Class Expanded Edition", documentType: "PRODUCT_DOCTRINE", authorityLevel: "PRODUCT_DOCTRINE", priority: "GLOBAL", workflowStages: ["LEAD_CAPTURE", "DISCOVERY_CALL", "TRANSCRIPT_ANALYSIS", "DIAGNOSTIC_REVIEW", "REPORT_GENERATION", "ROADMAP_GENERATION", "PROPOSAL_GENERATION"], useFor: "product behavior, closed-loop operating system, rollout logic, decision-quality standards" },
  { title: "Consulting-First Copy, UX, and Decision Architecture Standard", documentType: "UX_COPY_DOCTRINE", authorityLevel: "UX_COPY_DOCTRINE", priority: "GLOBAL", workflowStages: ["APP_UX", "TRANSCRIPT_ANALYSIS", "REPORT_GENERATION", "ROADMAP_GENERATION", "PROPOSAL_GENERATION"], useFor: "UI language, CTA wording, app copy, screen flow, report/proposal narrative structure" },
  { title: "Authority-Led Framework, Academy Positioning, and Operating Doctrine", documentType: "STRATEGY_FRAMEWORK", authorityLevel: "STRATEGY_FRAMEWORK", priority: "HIGH", workflowStages: ["OUTREACH", "DISCOVERY_CALL", "DIAGNOSTIC_REVIEW", "REPORT_GENERATION"], useFor: "category positioning, authority-led sales philosophy, diagnostic conversation framing" },
  { title: "Business Strategy, Scale, Integration & Exit Architecture", documentType: "STRATEGY_FRAMEWORK", authorityLevel: "STRATEGY_FRAMEWORK", priority: "HIGH", workflowStages: ["TRANSCRIPT_ANALYSIS", "REPORT_GENERATION", "ROADMAP_GENERATION", "ROI_MODELING"], useFor: "business strategy, scale planning, exit-readiness framing, strategic roadmap generation, ROI logic" },
  { title: "AI Solution Integration & Execution Handoff", documentType: "EXECUTION_HANDOFF", authorityLevel: "EXECUTION_HANDOFF", priority: "HIGH", workflowStages: ["PROPOSAL_GENERATION", "ROADMAP_GENERATION", "IMPLEMENTATION_HANDOFF"], useFor: "solution validation, ROI integration, proposal assembly, implementation handoff, execution-risk controls" },
  { title: "Finesse IT Layer Master Prompt", documentType: "REPORT_FRAMEWORK", authorityLevel: "STRATEGY_FRAMEWORK", priority: "HIGH", workflowStages: ["DIAGNOSTIC_REVIEW", "REPORT_GENERATION", "ROADMAP_GENERATION", "PROPOSAL_GENERATION"], useFor: "client-facing refinement, assumption scrutiny, ambiguity reduction, logic tightening" },
  { title: "26-Week Master Curriculum Detailed Instructional Build", documentType: "TRAINING_CURRICULUM", authorityLevel: "TRAINING_CURRICULUM", priority: "MEDIUM", workflowStages: ["ACADEMY_TRAINING", "DISCOVERY_CALL", "TRANSCRIPT_ANALYSIS", "ROI_MODELING", "OFFER_CREATION"], useFor: "academy/training content and internal methodology reference" },
  { title: "Mastery Template of Each Section of the Course", documentType: "COURSE_TEMPLATE", authorityLevel: "COURSE_TEMPLATE", priority: "MEDIUM", workflowStages: ["ACADEMY_TRAINING"], useFor: "course/module generation and instructional structure" },
  { title: "Authority Figure Prompt for Any Niche", documentType: "AUTHORITY_TEMPLATE", authorityLevel: "AUTHORITY_TEMPLATE", priority: "MEDIUM", workflowStages: ["AUTHORITY_ASSET_GENERATION", "OUTREACH", "POSITIONING"], useFor: "authority blueprint generation and niche positioning" },
  { title: "Any Niche Ultimate Authority Dominance Blueprint", documentType: "AUTHORITY_TEMPLATE", authorityLevel: "AUTHORITY_TEMPLATE", priority: "MEDIUM", workflowStages: ["AUTHORITY_ASSET_GENERATION", "POSITIONING", "REPORT_GENERATION"], useFor: "boardroom authority package, market intelligence, competitive positioning" }
] as const;

function parseStages(value: unknown): WorkflowStage[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return raw.map((stage) => String(stage).trim()).filter((stage): stage is WorkflowStage => (workflowStages as readonly string[]).includes(stage));
}
function parseTags(value: string | undefined) { return (value ?? "").split(",").map((tag) => tag.trim()).filter(Boolean); }
function emptyToNull(value: string | undefined) { return value ? value : null; }

export function chunkSourceText(sourceText: string, targetSize = 6000) {
  const blocks = sourceText.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const chunks: Array<{ heading?: string; text: string; characterCount: number }> = [];
  let current: string[] = [];
  let heading: string | undefined;
  const flush = () => {
    const text = current.join("\n\n").trim();
    if (text) chunks.push({ heading, text, characterCount: text.length });
    current = [];
    heading = undefined;
  };
  for (const block of blocks.length ? blocks : [sourceText]) {
    const isHeading = block.length <= 120 && (/^(#{1,4}\s|[A-Z][A-Z0-9\s:—-]{6,}$|\d+\.\s+)/.test(block));
    if (isHeading && current.join("\n\n").length > targetSize / 2) flush();
    if (!heading && isHeading) heading = block.replace(/^#{1,4}\s*/, "");
    if (current.join("\n\n").length + block.length > targetSize && current.length) flush();
    if (!heading && isHeading) heading = block.replace(/^#{1,4}\s*/, "");
    current.push(block);
  }
  flush();
  return chunks.length ? chunks : [{ text: sourceText, characterCount: sourceText.length }];
}

export async function regenerateKnowledgeChunks(workspaceId: string, documentId: string, actorId?: string) {
  const document = await prisma.knowledgeDocument.findFirst({ where: { id: documentId, workspaceId } });
  if (!document) notFound();
  const chunks = chunkSourceText(document.sourceText).map((chunk, index) => ({ workspaceId, documentId, chunkIndex: index, heading: chunk.heading, text: chunk.text, characterCount: chunk.characterCount, workflowStages: toPrismaJson(parseStages(document.workflowStages)), documentType: document.documentType, authorityLevel: document.authorityLevel, status: document.status }));
  await prisma.$transaction([prisma.knowledgeChunk.deleteMany({ where: { workspaceId, documentId } }), prisma.knowledgeChunk.createMany({ data: chunks })]);
  await audit(workspaceId, "knowledge.chunks_regenerated", "KnowledgeDocument", documentId, actorId, { chunkCount: chunks.length });
  return chunks.length;
}

export async function listKnowledgeDocuments(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId);
  return prisma.knowledgeDocument.findMany({ where: { workspaceId }, include: { chunks: { select: { id: true } }, usages: { select: { id: true } } }, orderBy: [{ priority: "asc" }, { updatedAt: "desc" }] });
}

export async function getKnowledgeDocument(workspaceId: string, id: string) {
  await requireWorkspaceAccess(workspaceId);
  const document = await prisma.knowledgeDocument.findFirst({ where: { id, workspaceId }, include: { chunks: { orderBy: { chunkIndex: "asc" } }, usages: { orderBy: { createdAt: "desc" }, take: 25 } } });
  if (!document) notFound();
  return document;
}

export async function createKnowledgeDocument(workspaceId: string, input: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const data = knowledgeDocumentSchema.parse(input);
  const stages = parseStages(data.workflowStages);
  const document = await prisma.knowledgeDocument.create({ data: { workspaceId, title: data.title, description: emptyToNull(data.description), documentType: data.documentType, authorityLevel: data.authorityLevel, priority: data.priority, workflowStages: toPrismaJson(stages), offerLine: emptyToNull(data.offerLine), audience: emptyToNull(data.audience), industry: emptyToNull(data.industry), tags: toPrismaJson(parseTags(data.tags)), status: data.status, version: data.version || "1.0", sourceFileName: emptyToNull(data.sourceFileName), sourceMimeType: emptyToNull(data.sourceMimeType), sourceText: data.sourceText, createdById: user.id } });
  await regenerateKnowledgeChunks(workspaceId, document.id, user.id);
  await audit(workspaceId, "knowledge.document_created", "KnowledgeDocument", document.id, user.id, { status: document.status, authorityLevel: document.authorityLevel });
  return document;
}

export async function bulkCreateKnowledgeDocuments(workspaceId: string, input: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const { documents } = bulkKnowledgeImportSchema.parse(input);
  const imported = [];
  for (const item of documents) {
    const stages = parseStages(item.workflowStages);
    const document = await prisma.knowledgeDocument.create({ data: { workspaceId, title: item.title, description: emptyToNull(item.description), documentType: item.documentType, authorityLevel: item.authorityLevel, priority: item.priority, workflowStages: toPrismaJson(stages), offerLine: emptyToNull(item.offerLine), audience: emptyToNull(item.audience), industry: emptyToNull(item.industry), tags: toPrismaJson(parseTags(item.tags)), status: item.status, version: item.version || "1.0", sourceFileName: emptyToNull(item.sourceFileName), sourceMimeType: emptyToNull(item.sourceMimeType) || "text/plain", sourceText: item.sourceText, createdById: user.id, approvedById: item.status === "ACTIVE" ? user.id : null, approvedAt: item.status === "ACTIVE" ? new Date() : null, lastReviewedAt: new Date() } });
    const chunkCount = await regenerateKnowledgeChunks(workspaceId, document.id, user.id);
    await audit(workspaceId, "knowledge.document_imported", "KnowledgeDocument", document.id, user.id, { status: document.status, authorityLevel: document.authorityLevel, sourceFileName: document.sourceFileName, chunkCount });
    imported.push({ id: document.id, title: document.title, status: document.status, chunkCount });
  }
  return { importedCount: imported.length, imported };
}

export async function updateKnowledgeDocument(workspaceId: string, id: string, input: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const existing = await prisma.knowledgeDocument.findFirst({ where: { id, workspaceId } });
  if (!existing) notFound();
  const data = knowledgeDocumentSchema.parse(input);
  const stages = parseStages(data.workflowStages);
  const document = await prisma.knowledgeDocument.update({ where: { id }, data: { title: data.title, description: emptyToNull(data.description), documentType: data.documentType, authorityLevel: data.authorityLevel, priority: data.priority, workflowStages: toPrismaJson(stages), offerLine: emptyToNull(data.offerLine), audience: emptyToNull(data.audience), industry: emptyToNull(data.industry), tags: toPrismaJson(parseTags(data.tags)), status: data.status, version: data.version || existing.version, sourceFileName: emptyToNull(data.sourceFileName), sourceMimeType: emptyToNull(data.sourceMimeType), sourceText: data.sourceText } });
  await regenerateKnowledgeChunks(workspaceId, id, user.id);
  await audit(workspaceId, "knowledge.document_edited", "KnowledgeDocument", id, user.id, { status: document.status });
  return document;
}

export async function setKnowledgeDocumentStatus(workspaceId: string, id: string, status: "ACTIVE" | "ARCHIVED" | "DRAFT") {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const existing = await prisma.knowledgeDocument.findFirst({ where: { id, workspaceId } });
  if (!existing) notFound();
  const document = await prisma.knowledgeDocument.update({ where: { id }, data: { status, approvedById: status === "ACTIVE" ? user.id : existing.approvedById, approvedAt: status === "ACTIVE" ? new Date() : existing.approvedAt, lastReviewedAt: new Date(), chunks: { updateMany: { where: { workspaceId }, data: { status } } } } });
  await audit(workspaceId, status === "ACTIVE" ? "knowledge.document_activated" : status === "ARCHIVED" ? "knowledge.document_archived" : "knowledge.document_drafted", "KnowledgeDocument", id, user.id, { status });
  return document;
}

export type KnowledgeRetrievalOptions = { workspaceId: string; workflowStage: WorkflowStage; documentTypes?: KnowledgeAuthorityLevel[]; authorityLevels?: KnowledgeAuthorityLevel[]; priorities?: KnowledgePriority[]; offerLine?: string; industry?: string; includeTemplates?: boolean; maxCharacters?: number; testMode?: boolean };

const authorityRank: Record<string, number> = { SYSTEM_DOCTRINE: 0, PRODUCT_DOCTRINE: 1, UX_COPY_DOCTRINE: 2, STRATEGY_FRAMEWORK: 6, DIAGNOSTIC_FRAMEWORK: 6, ROI_FRAMEWORK: 6, REPORT_FRAMEWORK: 6, ROADMAP_FRAMEWORK: 6, PROPOSAL_FRAMEWORK: 6, EXECUTION_HANDOFF: 6, REFERENCE: 8, TRAINING_CURRICULUM: 9, COURSE_TEMPLATE: 10, AUTHORITY_TEMPLATE: 10 };
const priorityRank: Record<string, number> = { GLOBAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const templateLevels = new Set(["AUTHORITY_TEMPLATE", "COURSE_TEMPLATE", "TRAINING_CURRICULUM"]);

export async function retrieveKnowledgeContext(options: KnowledgeRetrievalOptions) {
  const statuses = options.testMode ? ["ACTIVE", "DRAFT"] as const : ["ACTIVE"] as const;
  const chunks = await prisma.knowledgeChunk.findMany({
    where: { workspaceId: options.workspaceId, status: { in: [...statuses] }, document: { workspaceId: options.workspaceId, status: { in: [...statuses] }, ...(options.authorityLevels?.length ? { authorityLevel: { in: options.authorityLevels } } : {}), ...(options.documentTypes?.length ? { documentType: { in: options.documentTypes } } : {}), ...(options.priorities?.length ? { priority: { in: options.priorities } } : {}), ...(options.offerLine ? { OR: [{ offerLine: options.offerLine }, { offerLine: null }] } : {}), ...(options.industry ? { OR: [{ industry: options.industry }, { industry: null }] } : {}) } },
    include: { document: true },
    take: 200
  });
  const filtered = chunks.filter((chunk) => {
    const stages = parseStages(chunk.workflowStages);
    const global = chunk.document.priority === "GLOBAL" && ["SYSTEM_DOCTRINE", "PRODUCT_DOCTRINE", "UX_COPY_DOCTRINE"].includes(chunk.document.authorityLevel);
    const stageMatch = stages.includes(options.workflowStage);
    const templateAllowed = options.includeTemplates || !templateLevels.has(chunk.document.authorityLevel);
    return templateAllowed && (global || stageMatch);
  });
  const ordered = filtered.sort((a, b) => (authorityRank[a.document.authorityLevel] ?? 7) - (authorityRank[b.document.authorityLevel] ?? 7) || (priorityRank[a.document.priority] ?? 3) - (priorityRank[b.document.priority] ?? 3) || Number(!parseStages(a.workflowStages).includes(options.workflowStage)) - Number(!parseStages(b.workflowStages).includes(options.workflowStage)) || a.document.title.localeCompare(b.document.title) || a.chunkIndex - b.chunkIndex);
  let used = 0;
  const max = options.maxCharacters ?? 24000;
  const selected = [] as typeof ordered;
  for (const chunk of ordered) {
    if (used && used + chunk.text.length > max) continue;
    selected.push(chunk);
    used += chunk.text.length;
    if (used >= max) break;
  }
  return { chunks: selected, hasSources: selected.length > 0, warning: selected.length ? null : `No active source-of-truth documents found for ${options.workflowStage}. Base defaults were used.` };
}

export function summarizeSources(chunks: Awaited<ReturnType<typeof retrieveKnowledgeContext>>["chunks"], workflowStage: WorkflowStage) {
  const grouped = new Map<string, { documentId: string; title: string; version: string; documentType: string; authorityLevel: string; workflowStage: WorkflowStage; chunkIds: string[]; chunkIndexes: number[] }>();
  for (const chunk of chunks) {
    const item = grouped.get(chunk.documentId) ?? { documentId: chunk.documentId, title: chunk.document.title, version: chunk.document.version, documentType: chunk.document.documentType, authorityLevel: chunk.document.authorityLevel, workflowStage, chunkIds: [], chunkIndexes: [] };
    item.chunkIds.push(chunk.id); item.chunkIndexes.push(chunk.chunkIndex); grouped.set(chunk.documentId, item);
  }
  return [...grouped.values()];
}

export async function recordKnowledgeUsage(workspaceId: string, entityType: string, entityId: string, workflowStage: WorkflowStage, usedFor: string, chunks: Awaited<ReturnType<typeof retrieveKnowledgeContext>>["chunks"], actorId?: string) {
  if (!chunks.length) return;
  await prisma.knowledgeDocumentUsage.createMany({ data: chunks.map((chunk) => ({ workspaceId, documentId: chunk.documentId, chunkId: chunk.id, entityType, entityId, workflowStage, usedFor })) });
  await audit(workspaceId, "knowledge.document_used", entityType, entityId, actorId, { workflowStage, usedFor, sources: summarizeSources(chunks, workflowStage) });
}

export async function getSourcesForEntity(workspaceId: string, entityType: string, entityId: string) {
  await requireWorkspaceAccess(workspaceId);
  const usages = await prisma.knowledgeDocumentUsage.findMany({ where: { workspaceId, entityType, entityId }, include: { document: true, chunk: true }, orderBy: { createdAt: "desc" } });
  return summarizeSources(usages.filter((usage) => usage.chunk).map((usage) => ({ ...usage.chunk!, document: usage.document })), usages[0]?.workflowStage ?? "TRANSCRIPT_ANALYSIS");
}

export async function listWorkspaceRecords(workspaceId: string, model: "executiveReport" | "rOIModel" | "proposal" | "implementationProject" | "knowledgeRecord" | "strategicRoadmap") {
  await requireWorkspaceAccess(workspaceId);
  return (prisma[model] as { findMany(args: unknown): Promise<unknown[]> }).findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" }, take: 50 });
}

export async function archiveKnowledgeDocumentAndRedirect(workspaceId: string, id: string) { await setKnowledgeDocumentStatus(workspaceId, id, "ARCHIVED"); redirect(`/dashboard/knowledge/${id}`); }
