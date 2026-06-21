/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
export function getResearchConfig() { return { enabled: process.env.RESEARCH_ENABLED === "true", provider: process.env.RESEARCH_PROVIDER || "disabled", ready: process.env.RESEARCH_ENABLED === "true" && Boolean(process.env.RESEARCH_PROVIDER && process.env.RESEARCH_API_KEY) }; }
export async function createResearchRun(workspaceId: string, targetType: "CONTACT" | "COMPANY" | "DEAL" | "MEETING", targetId: string) {
  const cfg = getResearchConfig();
  return (prisma as any).researchRun.create({ data: { workspaceId, targetType, targetId, status: cfg.ready ? "QUEUED" : "DISABLED", provider: cfg.provider, summary: cfg.ready ? null : "Research provider not configured." } });
}
export async function generateInterviewQuestions(workspaceId: string, targetType: "CONTACT" | "COMPANY" | "DEAL" | "MEETING", targetId: string, context: any = {}) {
  const questions = [
    `What business outcome is most important for ${context.companyName ?? "the organization"} this quarter?`,
    `What manual revenue workflow creates the most delay today?`,
    `How are success metrics, ownership, and budget currently defined?`,
    `What would make this initiative urgent enough to prioritize now?`,
    `Who else needs to be involved before a proposal can be accepted?`
  ];
  return (prisma as any).interviewQuestionSet.create({ data: { workspaceId, targetType, targetId, questions, reviewRequired: true } });
}
