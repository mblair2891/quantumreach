import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";

export const GUIDED_SCENARIO_ID = "SUMMIT_DENTAL_GUIDED_JOURNEY";

export type JourneySignals = {
  profileComplete: boolean;
  prospectCount: number;
  researchCount: number;
  qualifiedCount: number;
  outreachDraftCount: number;
  activeOutreachCount: number;
  replyCount: number;
  scheduledMeetingCount: number;
  completedMeetingCount: number;
  analysisCount: number;
  proposalCount: number;
  sharedProposalCount: number;
  contractCount: number;
  executedContractCount: number;
  wonCount: number;
  clientCount: number;
  projectCount: number;
  completedDeliverableCount: number;
};

export type JourneyAction = { stage: string; title: string; why: string; href: string; blocker?: string };

const stages: Array<{ key: keyof JourneySignals; action: JourneyAction }> = [
  { key: "profileComplete", action: { stage: "Workspace setup", title: "Complete your agency profile", why: "Your profile provides reusable context for outreach, proposals, and agreements.", href: "/dashboard/onboarding" } },
  { key: "prospectCount", action: { stage: "Workspace ready", title: "Add your first prospect", why: "A company, contact, and opportunity connect the rest of the customer journey.", href: "/dashboard/crm" } },
  { key: "researchCount", action: { stage: "Prospect created", title: "Research your prospect", why: "Separate supplied facts from assumptions before deciding how to approach the buyer.", href: "/dashboard/research" } },
  { key: "qualifiedCount", action: { stage: "Prospect enriched", title: "Qualify the opportunity", why: "An explainable qualification decision keeps outreach focused on a credible need.", href: "/dashboard/opportunities" } },
  { key: "outreachDraftCount", action: { stage: "Opportunity qualified", title: "Draft your first outreach", why: "Prepare an editable, compliant sequence using approved prospect context.", href: "/dashboard/outreach" } },
  { key: "activeOutreachCount", action: { stage: "Outreach prepared", title: "Approve and activate outreach", why: "Approval is required before any live or clearly labeled simulated execution.", href: "/dashboard/outreach" } },
  { key: "replyCount", action: { stage: "Outreach active", title: "Record or simulate a reply", why: "A reply establishes buyer intent and unlocks meeting scheduling.", href: "/dashboard/sending/deliverability" } },
  { key: "scheduledMeetingCount", action: { stage: "Reply received", title: "Schedule a discovery call", why: "Associate the conversation with the prospect so notes and analysis remain connected.", href: "/dashboard/meetings/new" } },
  { key: "completedMeetingCount", action: { stage: "Meeting scheduled", title: "Complete the meeting and add notes", why: "Use live, imported, manual, or guided simulation evidence without claiming a provider event.", href: "/dashboard/meetings" } },
  { key: "analysisCount", action: { stage: "Meeting completed", title: "Generate and approve analysis", why: "Approved findings turn meeting evidence into proposal-ready strategy.", href: "/dashboard/analysis" } },
  { key: "proposalCount", action: { stage: "Analysis completed", title: "Create a proposal", why: "Reuse approved CRM and meeting context instead of entering it again.", href: "/dashboard/proposals" } },
  { key: "sharedProposalCount", action: { stage: "Proposal created", title: "Preview and share the proposal", why: "Review the exact version the prospect will see before recording a response.", href: "/dashboard/proposals" } },
  { key: "contractCount", action: { stage: "Proposal shared", title: "Create the agreement", why: "Carry accepted scope and editable pricing into a versioned contract.", href: "/dashboard/contracts" } },
  { key: "executedContractCount", action: { stage: "Agreement created", title: "Complete the agreement", why: "Record live signature evidence or an explicitly simulated completion.", href: "/dashboard/contracts" } },
  { key: "wonCount", action: { stage: "Agreement completed", title: "Mark the opportunity won", why: "Confirmation preserves the opportunity and starts retry-safe client conversion.", href: "/dashboard/opportunities" } },
  { key: "clientCount", action: { stage: "Opportunity won", title: "Activate the client", why: "Create the agency-client delivery relationship without provisioning a separate SaaS tenant.", href: "/dashboard/projects" } },
  { key: "projectCount", action: { stage: "Client activated", title: "Start client onboarding and delivery", why: "A delivery project makes ownership, milestones, and customer requests visible.", href: "/dashboard/projects" } },
  { key: "completedDeliverableCount", action: { stage: "Delivery active", title: "Complete the first deliverable", why: "Record an approved initial result before measuring retention or expansion.", href: "/dashboard/deliverables" } },
];

export function resolveNextBestAction(signals: JourneySignals): JourneyAction {
  const missing = stages.find(({ key }) => typeof signals[key] === "boolean" ? !signals[key] : signals[key] === 0);
  return missing?.action ?? { stage: "Initial result delivered", title: "Review client health and expansion", why: "The first lifecycle is complete; review results, revenue, and the next customer outcome.", href: "/dashboard/reports" };
}

export async function getGuidedJourney(workspaceId: string, profileComplete: boolean) {
  await requireWorkspaceAccess(workspaceId);
  const [prospectCount, researchCount, qualifiedCount, outreachDraftCount, activeOutreachCount, replyCount, scheduledMeetingCount, completedMeetingCount, analysisCount, proposalCount, sharedProposalCount, contractCount, executedContractCount, wonCount, clientCount, projectCount, completedDeliverableCount] = await Promise.all([
    prisma.opportunity.count({ where: { workspaceId, status: { not: "ARCHIVED" } } }),
    prisma.researchRun.count({ where: { workspaceId } }),
    prisma.lead.count({ where: { workspaceId, score: { gte: 60 } } }),
    prisma.outreachCampaign.count({ where: { workspaceId } }),
    prisma.outreachCampaign.count({ where: { workspaceId, status: "ACTIVE" } }),
    prisma.inboundEmailMessage.count({ where: { workspaceId } }),
    prisma.callSession.count({ where: { workspaceId, status: "SCHEDULED" } }),
    prisma.callSession.count({ where: { workspaceId, status: "COMPLETED" } }),
    prisma.analysisRecord.count({ where: { workspaceId } }),
    prisma.proposal.count({ where: { workspaceId } }),
    prisma.proposal.count({ where: { workspaceId, status: { in: ["REVIEWED", "FINAL"] } } }),
    prisma.contract.count({ where: { workspaceId } }),
    prisma.contract.count({ where: { workspaceId, status: "FINAL" } }),
    prisma.opportunity.count({ where: { workspaceId, status: "WON" } }),
    prisma.client.count({ where: { workspaceId, status: "ACTIVE" } }),
    prisma.implementationProject.count({ where: { workspaceId } }),
    prisma.projectTask.count({ where: { workspaceId, status: "DONE" } }),
  ]);
  const signals = { profileComplete, prospectCount, researchCount, qualifiedCount, outreachDraftCount, activeOutreachCount, replyCount, scheduledMeetingCount, completedMeetingCount, analysisCount, proposalCount, sharedProposalCount, contractCount, executedContractCount, wonCount, clientCount, projectCount, completedDeliverableCount };
  return { signals, nextAction: resolveNextBestAction(signals), completed: stages.filter(({ key }) => typeof signals[key] === "boolean" ? signals[key] : signals[key] > 0).length, total: stages.length };
}

/** Explicit, idempotent and provider-free guided-data entry point. */
export async function createSummitDentalExample(workspaceId: string) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const prior = await prisma.activity.findFirst({ where: { workspaceId, type: "SIMULATION_SCENARIO_CREATED", description: GUIDED_SCENARIO_ID }, orderBy: { createdAt: "asc" } });
  if (prior?.relatedId) {
    const opportunity = await prisma.opportunity.findFirst({ where: { id: prior.relatedId, workspaceId, status: { not: "ARCHIVED" } } });
    if (opportunity) return { opportunity, reused: true };
  }
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({ data: { workspaceId, name: "Summit Dental Group", domain: "summit-dental.example", industry: "Multi-location dental services", employeeCount: 28, createdById: user.id } });
    const contact = await tx.contact.create({ data: { workspaceId, companyId: company.id, firstName: "Maya", lastName: "Chen", title: "Owner and managing dentist", email: "maya.chen@summit-dental.example", createdById: user.id } });
    const lead = await tx.lead.create({ data: { workspaceId, companyId: company.id, contactId: contact.id, name: "Dr. Maya Chen — Summit Dental Group", email: contact.email, source: "Example guided journey", sourcePlatform: "Guided simulation", sourceNotes: "Fictional, example-safe prospect. Inconsistent new-patient lead flow and follow-up after the first attempt.", outreachPermissionStatus: "NEEDS_REVIEW", createdById: user.id } });
    const opportunity = await tx.opportunity.create({ data: { workspaceId, companyId: company.id, contactId: contact.id, leadId: lead.id, name: "AI lead reactivation and follow-up system", amount: new Prisma.Decimal(4500), status: "OPEN", createdById: user.id } });
    await tx.activity.create({ data: { workspaceId, type: "SIMULATION_SCENARIO_CREATED", title: "Example prospect created (simulated)", description: GUIDED_SCENARIO_ID, relatedType: "Opportunity", relatedId: opportunity.id, createdById: user.id } });
    await tx.note.create({ data: { workspaceId, relatedType: "Opportunity", relatedId: opportunity.id, createdById: user.id, body: "Fictional example offer: $4,500 setup plus $2,000 monthly. Values are editable and are not an invoice or payment record." } });
    return { opportunity, reused: false };
  });
}
