import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit/service";
import { getAIProvider } from "@/lib/ai/provider";
import { toPrismaJson } from "@/lib/db/json";

const analyzerPrompts = {
  diagnostic_summary: "Summarize the business diagnostic with executive language and evidence-backed findings.",
  constraint_extraction: "Extract constraints, bottlenecks, risks, and recommendations from CRM and diagnostic context.",
  roi_model: "Generate an ROI and cost-of-inaction model with assumptions and confidence scoring.",
  executive_report: "Create an executive recommendation report with sections and next decisions.",
  strategic_roadmap: "Create a phased strategic roadmap and implementation sequence."
};

export async function runAnalyzer(workspaceId: string, analyzerKey: keyof typeof analyzerPrompts, input: Record<string, unknown>) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const definition = await prisma.analyzerDefinition.upsert({ where: { workspaceId_key: { workspaceId, key: analyzerKey } }, update: {}, create: { workspaceId, key: analyzerKey, name: analyzerKey.replaceAll("_", " "), description: analyzerPrompts[analyzerKey] } });
  const aiInput = toPrismaJson(input);
  const run = await prisma.analyzerRun.create({ data: { workspaceId, analyzerDefinitionId: definition.id, input: aiInput, status: "RUNNING", startedAt: new Date(), createdById: user.id } });
  const execution = await prisma.aIExecution.create({ data: { workspaceId, analyzerRunId: run.id, provider: "openai", model: process.env.OPENAI_DEFAULT_MODEL ?? "gpt-4.1-mini", input: aiInput, status: "RUNNING", startedAt: new Date(), createdById: user.id } });
  try {
    const result = await getAIProvider().runStructured({ system: analyzerPrompts[analyzerKey], user: JSON.stringify(input), schemaName: analyzerKey });
    const aiOutput = toPrismaJson(result.json);
    const [updatedRun] = await prisma.$transaction([
      prisma.analyzerRun.update({ where: { id: run.id }, data: { output: aiOutput, status: "SUCCEEDED", completedAt: new Date(), reviewStatus: "NEEDS_REVIEW" } }),
      prisma.aIExecution.update({ where: { id: execution.id }, data: { output: aiOutput, status: "SUCCEEDED", model: result.model, completedAt: new Date() } }),
      prisma.aIOutputArtifact.create({ data: { workspaceId, analyzerRunId: run.id, aiExecutionId: execution.id, artifactType: analyzerKey, content: aiOutput, reviewStatus: "DRAFT", createdById: user.id } })
    ]);
    await audit(workspaceId, "run", "AnalyzerRun", run.id, user.id, { analyzerKey });
    return updatedRun;
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI execution failed";
    await prisma.$transaction([prisma.analyzerRun.update({ where: { id: run.id }, data: { status: "FAILED", error: message, completedAt: new Date() } }), prisma.aIExecution.update({ where: { id: execution.id }, data: { status: "FAILED", error: message, completedAt: new Date() } })]);
    throw new Error("Analyzer execution failed. Review AI execution logs for details.");
  }
}
