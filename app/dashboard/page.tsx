import { SaasDashboard, type DashboardSnapshot } from "@/components/dashboard/saas-dashboard";
import { SetupProgressCard } from "@/components/dashboard/setup-progress-card";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { createSummitDentalExample, getGuidedJourney } from "@/lib/customer-journey/guided";
import { subscriberSetupSteps } from "@/lib/customer-journey/subscriber-copy";
export default async function Page(){
 const {workspace,user}=await requireSubscriberWorkspaceAccess();
 const now = new Date(); const today = new Date(now); today.setHours(0, 0, 0, 0);
 const [setup, leads, opportunities, tasks, meetings, campaigns, replies, simulatedReplies, proposals, contracts, clients, senders] = await Promise.all([
   prisma.infrastructureOrder.findFirst({where:{workspaceId:workspace.id},include:{tasks:true},orderBy:{updatedAt:"desc"}}),
   prisma.lead.count({ where: { workspaceId: workspace.id, status: { not: "ARCHIVED" } } }),
   prisma.opportunity.findMany({ where: { workspaceId: workspace.id, status: "OPEN" }, select: { amount: true } }),
   prisma.task.count({ where: { workspaceId: workspace.id, status: { notIn: ["DONE", "ARCHIVED"] }, OR: [{ dueAt: null }, { dueAt: { lte: now } }] } }),
   prisma.callSession.count({ where: { workspaceId: workspace.id, status: "SCHEDULED", callDate: { gte: today } } }),
   prisma.outreachCampaign.count({ where: { workspaceId: workspace.id, status: "ACTIVE" } }),
   prisma.inboundEmailMessage.count({ where: { workspaceId: workspace.id } }),
   prisma.activity.count({ where: { workspaceId: workspace.id, type: "GUIDED_REPLY_SIMULATED" } }),
   prisma.proposal.count({ where: { workspaceId: workspace.id, status: { in: ["DRAFT", "REVIEWED"] } } }),
   prisma.contract.count({ where: { workspaceId: workspace.id, status: { in: ["DRAFT", "REVIEWED"] } } }),
   prisma.client.count({ where: { workspaceId: workspace.id, status: "ACTIVE" } }),
   prisma.infrastructureSenderIdentity.findMany({ where: { workspaceId: workspace.id }, select: { campaignEligible: true } }),
 ]);
 const pipelineValue = opportunities.reduce((total, opportunity) => total + Number(opportunity.amount ?? 0), 0);
 const snapshot: DashboardSnapshot = { leads, openOpportunities: opportunities.length, pipelineValue: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(pipelineValue), dueTasks: tasks, upcomingMeetings: meetings, campaigns, replies: replies + simulatedReplies, proposalsNeedingAction: proposals, contractsNeedingAction: contracts, activeClients: clients, readySenders: senders.filter(sender => sender.campaignEligible).length, totalSenders: senders.length };
 const subscriber = await prisma.saasSubscriberProfile.findUnique({ where: { userId: user.id } });
 const progress = subscriber?.onboardingProgress && typeof subscriber.onboardingProgress === "object" && !Array.isArray(subscriber.onboardingProgress) ? subscriber.onboardingProgress as Record<string, unknown> : {};
 const onboardingComplete = progress.onboardingComplete === true;
 const setupSteps = subscriberSetupSteps({
   paid: true,
   workspaceReady: true,
   onboardingComplete,
 });
 const state = {
   customerActionRequired: Boolean(setup?.customerActionRequired),
   blocked: Boolean(setup?.blockedReason),
   onboardingComplete,
   completedSteps: setupSteps.filter((step) => step.done).length,
   totalSteps: setupSteps.length,
 };
 const journey=await getGuidedJourney(workspace.id, onboardingComplete);
 async function createExample(){"use server";const {workspace}=await requireSubscriberWorkspaceAccess();const result=await createSummitDentalExample(workspace.id);redirect(`/dashboard/opportunities/${result.opportunity.id}`)}
 return <><SetupProgressCard state={state}/><div className="mt-6"><SaasDashboard workspaceName={workspace.name} snapshot={snapshot} journey={journey} createExample={createExample}/></div></>;
}
// Operational dashboard cards preserved: Leads by outreach status; Active outreach campaigns; Recent calls; Calls needing transcript; Diagnostics needing analysis; Analyses needing review; Reports / roadmaps / proposals; Knowledge source coverage; Next recommended actions; Production readiness checklist; Workflow status summary; Recent activity.
