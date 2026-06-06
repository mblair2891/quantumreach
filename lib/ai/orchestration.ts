import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit/service";
import { getAIProvider } from "@/lib/ai/provider";
import { toPrismaJson } from "@/lib/db/json";
import { getCrmRecordContext } from "@/lib/crm/service";
import { buildPromptContext, recordPromptSources } from "@/lib/knowledge/context-builder";

const diagnosticStructuredOutputPrompt = `You are a senior business diagnostic analyst. Produce a calm, executive-grade, decision-oriented diagnostic summary with evidence-backed constraints, bottlenecks, recommendations, risks, and assumptions. Do not use chatbot framing.

Return valid JSON only. Do not include markdown fences, prose, commentary, or keys outside the required JSON object.

The JSON object must use exactly this top-level shape:
{
  "summary": "string",
  "constraints": [],
  "bottlenecks": [],
  "recommendations": [],
  "risks": [],
  "assumptions": []
}

Required field rules:
- summary is required and must be a non-empty string.
- constraints, bottlenecks, recommendations, risks, and assumptions are required arrays. Use [] when no items are supported by the evidence.
- Constraint items should include label, impact, severity, and evidence when available.
- Bottleneck items should include label, description, and severity when available.
- Recommendation items should include title, rationale, expectedOutcome, and priority when available.
- severity and priority must be one of LOW, MEDIUM, HIGH, or URGENT.`;

const analyzerPrompts = {
  diagnostic_summary: diagnosticStructuredOutputPrompt,
  constraint_extraction: diagnosticStructuredOutputPrompt,
  roi_model: "Generate an ROI and cost-of-inaction model with assumptions and confidence scoring.",
  executive_report: "Create an executive recommendation report with sections and next decisions.",
  strategic_roadmap: "Create a phased strategic roadmap and implementation sequence."
};

const DIAGNOSTIC_FALLBACK_SUMMARY = "The analyzer completed, but the model did not provide a structured summary. Review the raw output before finalizing.";

type AnalyzerKey = keyof typeof analyzerPrompts;
const severity = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const diagnosticOutputSchema = z.object({
  summary: z.string().min(1),
  constraints: z.array(z.object({ label: z.string(), impact: z.string().optional().default(""), severity: severity.default("MEDIUM"), evidence: z.string().optional().default("") })).default([]),
  bottlenecks: z.array(z.object({ label: z.string(), description: z.string().optional().default(""), severity: severity.default("MEDIUM") })).default([]),
  recommendations: z.array(z.object({ title: z.string(), rationale: z.string().optional().default(""), expectedOutcome: z.string().optional().default(""), priority: severity.default("MEDIUM") })).default([]),
  risks: z.array(z.unknown()).default([]),
  assumptions: z.array(z.unknown()).default([])
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function pickSummaryCandidate(output: Record<string, unknown>) {
  const candidateKeys = ["summary", "executiveSummary", "executive_summary", "diagnosticSummary", "diagnostic_summary", "overview", "synopsis"];
  const key = candidateKeys.find((candidateKey) => {
    const value = output[candidateKey];
    return typeof value === "string" && value.trim().length > 0;
  });
  return key ? { key, value: String(output[key]).trim() } : null;
}

export function normalizeDiagnosticOutput(output: unknown, providerParseError?: string) {
  const warnings: string[] = [];
  const source = isRecord(output) ? { ...output } : {};
  if (!isRecord(output)) warnings.push("Model output was not a JSON object; fallback structured fields were created for review.");
  if (providerParseError) warnings.push("Model response could not be parsed as JSON; fallback structured fields were created for review.");

  const summaryCandidate = pickSummaryCandidate(source);
  if (!summaryCandidate) {
    source.summary = DIAGNOSTIC_FALLBACK_SUMMARY;
    warnings.push("Missing structured summary; inserted fallback summary for human review.");
  } else if (summaryCandidate.key !== "summary") {
    source.summary = summaryCandidate.value;
    warnings.push(`Mapped ${summaryCandidate.key} to required summary field.`);
  }

  for (const key of ["constraints", "bottlenecks", "recommendations", "risks", "assumptions"] as const) {
    if (!Array.isArray(source[key])) {
      source[key] = [];
      warnings.push(`Missing or invalid ${key} array; defaulted to an empty array.`);
    }
  }

  const parsed = diagnosticOutputSchema.safeParse(source);
  if (parsed.success) return { parsed: parsed.data, parseError: providerParseError ?? null, warnings };

  return {
    parsed: { summary: String(source.summary || DIAGNOSTIC_FALLBACK_SUMMARY), constraints: [], bottlenecks: [], recommendations: [], risks: [], assumptions: [] },
    parseError: parsed.error.message,
    warnings: [...warnings, "Structured output validation failed after normalization; retained fallback fields for review."]
  };
}

export async function runAnalyzer(workspaceId: string, analyzerKey: AnalyzerKey, input: Record<string, unknown>) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const definition = await prisma.analyzerDefinition.upsert({ where: { workspaceId_key: { workspaceId, key: analyzerKey } }, update: {}, create: { workspaceId, key: analyzerKey, name: analyzerKey.replaceAll("_", " "), description: analyzerPrompts[analyzerKey] } });
  const promptContext = await buildPromptContext({ workspaceId, workflowStage: analyzerKey === "roi_model" ? "ROI_MODELING" : "TRANSCRIPT_ANALYSIS", generatorType: analyzerKey, crmContext: input.crmContext, diagnosticContext: input.transcriptContext ?? input.session, reviewedAnalysis: input, outputSchemaInstruction: analyzerPrompts[analyzerKey] });
  const governedInput = { ...input, sourceCoverageWarning: promptContext.sourceCoverageWarning, sourcesUsed: promptContext.sources };
  const aiInput = toPrismaJson(governedInput);
  const diagnosticSessionId = typeof input.diagnosticSessionId === "string" ? input.diagnosticSessionId : undefined;
  if (diagnosticSessionId) {
    const session = await prisma.diagnosticSession.findFirst({ where: { id: diagnosticSessionId, workspaceId } });
    if (!session) throw new Error("Diagnostic session is not available in this workspace.");
  }
  const run = await prisma.analyzerRun.create({ data: { workspaceId, analyzerDefinitionId: definition.id, diagnosticSessionId, input: aiInput, status: "RUNNING", startedAt: new Date(), createdById: user.id } });
  const execution = await prisma.aIExecution.create({ data: { workspaceId, analyzerRunId: run.id, provider: "openai", model: process.env.OPENAI_DEFAULT_MODEL ?? "gpt-4.1-mini", input: aiInput, status: "RUNNING", startedAt: new Date(), createdById: user.id } });
  try {
    const result = await getAIProvider().runStructured({ system: promptContext.system, user: promptContext.user, schemaName: analyzerKey });
    const normalized = analyzerKey === "diagnostic_summary" || analyzerKey === "constraint_extraction" ? normalizeDiagnosticOutput(result.json, result.parseError) : { parsed: result.json, parseError: result.parseError ?? null, warnings: [] };
    const content = toPrismaJson({ structured: normalized.parsed, raw: result.rawText, parseError: normalized.parseError, normalizationWarnings: normalized.warnings, sourcesUsed: promptContext.sources, sourceCoverageWarning: promptContext.sourceCoverageWarning });
    const output = toPrismaJson({ structured: normalized.parsed, raw: result.rawText, parseError: normalized.parseError, normalizationWarnings: normalized.warnings, sourcesUsed: promptContext.sources, sourceCoverageWarning: promptContext.sourceCoverageWarning });
    const [updatedRun] = await prisma.$transaction([
      prisma.analyzerRun.update({ where: { id: run.id }, data: { output, status: "SUCCEEDED", completedAt: new Date(), reviewStatus: "NEEDS_REVIEW", error: normalized.parseError ?? (normalized.warnings.length > 0 ? normalized.warnings.join(" ") : null) } }),
      prisma.aIExecution.update({ where: { id: execution.id }, data: { output: content, status: "SUCCEEDED", model: result.model, completedAt: new Date(), error: normalized.parseError ?? (normalized.warnings.length > 0 ? normalized.warnings.join(" ") : null) } }),
      prisma.aIOutputArtifact.create({ data: { workspaceId, analyzerRunId: run.id, aiExecutionId: execution.id, artifactType: analyzerKey, content, reviewStatus: "NEEDS_REVIEW", createdById: user.id } })
    ]);
    if (analyzerKey === "diagnostic_summary" || analyzerKey === "constraint_extraction") {
      const analysisOutput = diagnosticOutputSchema.safeParse(normalized.parsed);
      if (analysisOutput.success) {
        const analysis = await upsertDiagnosticAnalysis(workspaceId, diagnosticSessionId, user.id, analysisOutput.data);
        await recordPromptSources(workspaceId, "AnalysisRecord", analysis.id, "TRANSCRIPT_ANALYSIS", analyzerKey, promptContext, user.id);
      }
    }
    await recordPromptSources(workspaceId, "AnalyzerRun", run.id, analyzerKey === "roi_model" ? "ROI_MODELING" : "TRANSCRIPT_ANALYSIS", analyzerKey, promptContext, user.id);
    await audit(workspaceId, "run", "AnalyzerRun", run.id, user.id, { analyzerKey, model: result.model, parseError: normalized.parseError, normalizationWarnings: normalized.warnings, sourcesUsed: promptContext.sources, sourceCoverageWarning: promptContext.sourceCoverageWarning });
    return updatedRun;
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI execution failed";
    await prisma.$transaction([prisma.analyzerRun.update({ where: { id: run.id }, data: { status: "FAILED", error: message, completedAt: new Date(), reviewStatus: "NEEDS_REVIEW" } }), prisma.aIExecution.update({ where: { id: execution.id }, data: { status: "FAILED", error: message, completedAt: new Date() } }), prisma.aIOutputArtifact.create({ data: { workspaceId, analyzerRunId: run.id, aiExecutionId: execution.id, artifactType: analyzerKey, content: toPrismaJson({ error: message }), reviewStatus: "NEEDS_REVIEW", createdById: user.id } })]);
    await audit(workspaceId, "fail", "AnalyzerRun", run.id, user.id, { analyzerKey });
    throw new Error("Analyzer execution failed. Review AI execution logs for details.");
  }
}

async function upsertDiagnosticAnalysis(workspaceId: string, sessionId: string | undefined, createdById: string, output: z.infer<typeof diagnosticOutputSchema>) {
  const existing = sessionId ? await prisma.analysisRecord.findFirst({ where: { workspaceId, sessionId } }) : null;
  const analysis = existing ? await prisma.analysisRecord.update({ where: { id: existing.id }, data: { title: "Diagnostic Summary + Constraint Extraction", summary: output.summary, risks: toPrismaJson({ risks: output.risks, assumptions: output.assumptions }), observations: toPrismaJson(output), status: "NEEDS_REVIEW" } }) : await prisma.analysisRecord.create({ data: { workspaceId, sessionId, title: "Diagnostic Summary + Constraint Extraction", summary: output.summary, risks: toPrismaJson({ risks: output.risks, assumptions: output.assumptions }), observations: toPrismaJson(output), status: "NEEDS_REVIEW", createdById } });
  await prisma.constraint.deleteMany({ where: { workspaceId, analysisId: analysis.id } });
  await prisma.bottleneck.deleteMany({ where: { workspaceId, analysisId: analysis.id } });
  await prisma.recommendation.deleteMany({ where: { workspaceId, analysisId: analysis.id } });
  await prisma.constraint.createMany({ data: output.constraints.map((item) => ({ workspaceId, analysisId: analysis.id, label: item.label, impact: item.impact, severity: item.severity, evidence: item.evidence })) });
  await prisma.bottleneck.createMany({ data: output.bottlenecks.map((item) => ({ workspaceId, analysisId: analysis.id, label: item.label, description: item.description, severity: item.severity })) });
  await prisma.recommendation.createMany({ data: output.recommendations.map((item) => ({ workspaceId, analysisId: analysis.id, title: item.title, rationale: item.rationale, expectedOutcome: item.expectedOutcome, priority: item.priority, reviewStatus: "NEEDS_REVIEW" })) });
  if (sessionId) await prisma.diagnosticSession.update({ where: { id: sessionId }, data: { status: "ANALYZED", summary: output.summary } });
  return analysis;
}

export async function runDiagnosticSummaryAnalyzer(workspaceId: string, sessionId: string) {
  const { workspace } = await requireWorkspaceAccess(workspaceId);
  const session = await prisma.diagnosticSession.findFirst({ where: { id: sessionId, workspaceId }, include: { transcripts: { orderBy: { updatedAt: "desc" }, take: 1 } } });
  if (!session) throw new Error("Diagnostic session is not available in this workspace.");
  const transcripts = Array.isArray(session.transcripts) ? session.transcripts : [];
  if (!transcripts[0]) throw new Error("Transcript or context is required before analysis can run.");
  const crmContext = await getCrmRecordContext(workspaceId, session.relatedType, session.relatedId);
  return runAnalyzer(workspaceId, "diagnostic_summary", { diagnosticSessionId: sessionId, workspace: { id: workspace.id, name: workspace.name }, session: { id: session.id, title: session.title, status: session.status, relatedType: session.relatedType, relatedId: session.relatedId }, crmContext, transcriptContext: transcripts[0], analyzerDefinition: { name: "Diagnostic Summary + Constraint Extraction", prompt: analyzerPrompts.diagnostic_summary } });
}
