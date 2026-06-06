import type { KnowledgeAuthorityLevel, WorkflowStage } from "@prisma/client";
import { recordKnowledgeUsage, retrieveKnowledgeContext, summarizeSources } from "@/lib/knowledge/service";

const generatorTemplates: Partial<Record<WorkflowStage, KnowledgeAuthorityLevel[]>> = {
  REPORT_GENERATION: ["REPORT_FRAMEWORK", "STRATEGY_FRAMEWORK", "SYSTEM_DOCTRINE", "UX_COPY_DOCTRINE"],
  ROADMAP_GENERATION: ["ROADMAP_FRAMEWORK", "STRATEGY_FRAMEWORK", "PRODUCT_DOCTRINE", "EXECUTION_HANDOFF"],
  PROPOSAL_GENERATION: ["PROPOSAL_FRAMEWORK", "UX_COPY_DOCTRINE", "EXECUTION_HANDOFF", "STRATEGY_FRAMEWORK"],
  TRANSCRIPT_ANALYSIS: ["SYSTEM_DOCTRINE", "UX_COPY_DOCTRINE", "DIAGNOSTIC_FRAMEWORK", "STRATEGY_FRAMEWORK", "TRAINING_CURRICULUM"],
  ROI_MODELING: ["ROI_FRAMEWORK", "STRATEGY_FRAMEWORK", "TRAINING_CURRICULUM"],
  IMPLEMENTATION_HANDOFF: ["EXECUTION_HANDOFF", "STRATEGY_FRAMEWORK"],
  AUTHORITY_ASSET_GENERATION: ["AUTHORITY_TEMPLATE"]
};

export type PromptContextOptions = {
  workspaceId: string;
  workflowStage: WorkflowStage;
  generatorType: string;
  crmContext?: unknown;
  diagnosticContext?: unknown;
  reviewedAnalysis?: unknown;
  outputSchemaInstruction: string;
  offerLine?: string;
  industry?: string;
  testMode?: boolean;
  maxKnowledgeCharacters?: number;
};

function safeJson(value: unknown) { return JSON.stringify(value ?? {}, null, 2); }

export async function buildPromptContext(options: PromptContextOptions) {
  const includeTemplates = options.workflowStage === "AUTHORITY_ASSET_GENERATION" || ["proposal", "roadmap", "report"].some((part) => options.generatorType.toLowerCase().includes(part));
  const retrieval = await retrieveKnowledgeContext({ workspaceId: options.workspaceId, workflowStage: options.workflowStage, documentTypes: generatorTemplates[options.workflowStage], offerLine: options.offerLine, industry: options.industry, includeTemplates, testMode: options.testMode, maxCharacters: options.maxKnowledgeCharacters }).catch(() => ({ chunks: [], hasSources: false, warning: `No active source-of-truth documents found for ${options.workflowStage}. Base defaults were used.` }));
  const sourceExcerpts = retrieval.chunks.map((chunk, index) => `[Source ${index + 1}: ${chunk.document.title} v${chunk.document.version} | ${chunk.document.documentType} | chunk ${chunk.chunkIndex}]\n${chunk.text}`).join("\n\n---\n\n");
  const system = [
    "You are Quantum Reach's governed executive AI operator.",
    "Use active source-of-truth documents as governing guidance.",
    "Do not invent service offerings outside approved frameworks.",
    "Do not contradict active source-of-truth documents.",
    "If transcript evidence conflicts with a framework, state the conflict as an assumption or risk.",
    "Return valid structured JSON only.",
    "Preserve executive-grade tone.",
    "Do not use hype, slang, emojis, or AI-revealing language.",
    "Follow the required narrative arc where relevant: Orientation → Observation → Constraint → Implication → Benchmark → Resolution Paths.",
    retrieval.warning ? `SOURCE COVERAGE WARNING: ${retrieval.warning}` : "SOURCE COVERAGE: Active source-of-truth excerpts are available and must govern the output."
  ].join("\n");
  const user = [
    "1. System behavior rules", system,
    "2. Governing source-of-truth excerpts", sourceExcerpts || "No active source-of-truth excerpts were available; use base defaults and surface the source coverage warning.",
    "3. Workflow-specific knowledge excerpts", sourceExcerpts || "None available.",
    "4. CRM / lead / opportunity context", safeJson(options.crmContext),
    "5. Diagnostic transcript/context", safeJson(options.diagnosticContext),
    "6. Prior reviewed analysis", safeJson(options.reviewedAnalysis),
    "7. Required output schema", options.outputSchemaInstruction,
    "8. Review/finalization rules", "Keep output in review-needed draft posture. Do not imply final approval."
  ].join("\n\n");
  return { system, user, chunks: retrieval.chunks, sources: summarizeSources(retrieval.chunks, options.workflowStage), sourceCoverageWarning: retrieval.warning };
}

export async function recordPromptSources(workspaceId: string, entityType: string, entityId: string, workflowStage: WorkflowStage, usedFor: string, context: Awaited<ReturnType<typeof buildPromptContext>>, actorId?: string) {
  await recordKnowledgeUsage(workspaceId, entityType, entityId, workflowStage, usedFor, context.chunks, actorId);
}
