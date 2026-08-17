import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";
import { convertWonOpportunityToClient } from "@/lib/crm/service";

export const GUIDED_SCENARIO_ID = "SUMMIT_DENTAL_GUIDED_JOURNEY";
const marker = (step: string) => `GUIDED_${step}`;
export const transitionOrder = ["RESEARCH", "QUALIFIED", "OUTREACH_DRAFT", "OUTREACH_APPROVED", "SEND_SIMULATED", "REPLY_SIMULATED", "MEETING_SCHEDULED", "MEETING_COMPLETED", "ANALYSIS_CREATED", "ANALYSIS_APPROVED", "PROPOSAL_CREATED", "PROPOSAL_SHARED", "PROPOSAL_ACCEPTED", "CONTRACT_CREATED", "AGREEMENT_COMPLETED", "OPPORTUNITY_WON", "CLIENT_CONVERTED", "ONBOARDING_CREATED", "DELIVERY_PLAN_CREATED", "DELIVERABLE_CREATED", "DELIVERABLE_APPROVED"] as const;
export type GuidedStep = typeof transitionOrder[number];

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
  { key: "profileComplete", action: { stage: "Workspace setup", title: "Complete your setup", why: "A few details are still needed to complete your workspace.", href: "/dashboard/onboarding" } },
  { key: "prospectCount", action: { stage: "Workspace ready", title: "Add your first prospect", why: "A company, contact, and opportunity connect the rest of your client pipeline.", href: "/dashboard/crm" } },
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
  { key: "projectCount", action: { stage: "Client activated", title: "Start client onboarding and delivery", why: "A delivery project makes ownership, milestones, and client requests visible.", href: "/dashboard/projects" } },
  { key: "completedDeliverableCount", action: { stage: "Delivery active", title: "Complete the first deliverable", why: "Record an approved initial result before measuring retention or expansion.", href: "/dashboard/deliverables" } },
];

export function resolveNextBestAction(signals: JourneySignals): JourneyAction {
  const missing = stages.find(({ key }) => typeof signals[key] === "boolean" ? !signals[key] : signals[key] === 0);
  return missing?.action ?? { stage: "Initial result delivered", title: "Review client health and expansion", why: "The first lifecycle is complete; review results, revenue, and the next client outcome.", href: "/dashboard/reports" };
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
  const scenarioEvents = await prisma.activity.findMany({ where: { workspaceId, description: GUIDED_SCENARIO_ID }, select: { type: true } });
  const event = new Set(scenarioEvents.map(item => item.type));
  const signals = { profileComplete, prospectCount, researchCount: Math.max(researchCount, Number(event.has(marker("RESEARCH")))), qualifiedCount: Math.max(qualifiedCount, Number(event.has(marker("QUALIFIED")))), outreachDraftCount: Math.max(outreachDraftCount, Number(event.has(marker("OUTREACH_DRAFT")))), activeOutreachCount: Math.max(activeOutreachCount, Number(event.has(marker("OUTREACH_APPROVED")))), replyCount: Math.max(replyCount, Number(event.has(marker("REPLY_SIMULATED")))), scheduledMeetingCount: Math.max(scheduledMeetingCount, Number(event.has(marker("MEETING_SCHEDULED")))), completedMeetingCount: Math.max(completedMeetingCount, Number(event.has(marker("MEETING_COMPLETED")))), analysisCount: Math.max(analysisCount, Number(event.has(marker("ANALYSIS_APPROVED")))), proposalCount: Math.max(proposalCount, Number(event.has(marker("PROPOSAL_CREATED")))), sharedProposalCount: Math.max(sharedProposalCount, Number(event.has(marker("PROPOSAL_SHARED")))), contractCount: Math.max(contractCount, Number(event.has(marker("CONTRACT_CREATED")))), executedContractCount: Math.max(executedContractCount, Number(event.has(marker("AGREEMENT_COMPLETED")))), wonCount: Math.max(wonCount, Number(event.has(marker("OPPORTUNITY_WON")))), clientCount: Math.max(clientCount, Number(event.has(marker("CLIENT_CONVERTED")))), projectCount: Math.max(projectCount, Number(event.has(marker("DELIVERY_PLAN_CREATED")))), completedDeliverableCount: Math.max(completedDeliverableCount, Number(event.has(marker("DELIVERABLE_APPROVED")))) };
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

async function context(workspaceId: string) {
  const created = await prisma.activity.findFirst({ where: { workspaceId, type: "SIMULATION_SCENARIO_CREATED", description: GUIDED_SCENARIO_ID }, orderBy: { createdAt: "desc" } });
  if (!created?.relatedId) throw new Error("Create the Summit Dental example prospect before continuing.");
  const opportunity = await prisma.opportunity.findFirst({ where: { id: created.relatedId, workspaceId }, include: { company: true, contact: true } });
  if (!opportunity?.companyId || !opportunity.contactId || !opportunity.leadId) throw new Error("The example prospect is incomplete or belongs to another workspace.");
  return { opportunity, companyId: opportunity.companyId, contactId: opportunity.contactId, leadId: opportunity.leadId };
}

async function completedSteps(workspaceId: string, opportunityId: string) {
  const events = await prisma.activity.findMany({ where: { workspaceId, relatedType: "Opportunity", relatedId: opportunityId, type: { in: transitionOrder.map(marker) } }, select: { type: true } });
  return new Set(events.map(event => event.type.replace("GUIDED_", "")));
}

export async function getExampleJourneyState(workspaceId: string, opportunityId: string) {
  await requireWorkspaceAccess(workspaceId);
  const created = await prisma.activity.count({ where: { workspaceId, type: "SIMULATION_SCENARIO_CREATED", description: GUIDED_SCENARIO_ID, relatedId: opportunityId } });
  if (!created) return null;
  const done = await completedSteps(workspaceId, opportunityId);
  const next = transitionOrder.find(step => !done.has(step)) ?? null;
  return { next, completed: done.size, total: transitionOrder.length, isComplete: !next };
}

function activity(workspaceId: string, opportunityId: string, userId: string, step: GuidedStep, title: string) {
  return prisma.activity.create({ data: { workspaceId, type: marker(step), title: `${title} (simulated)`, description: GUIDED_SCENARIO_ID, relatedType: "Opportunity", relatedId: opportunityId, createdById: userId } });
}

/** Executes exactly one prerequisite-checked, provider-free transition. Replays are idempotent. */
export async function advanceExampleJourney(workspaceId: string) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const c = await context(workspaceId);
  const done = await completedSteps(workspaceId, c.opportunity.id);
  const step = transitionOrder.find(item => !done.has(item));
  if (!step) return { step: null, opportunityId: c.opportunity.id };
  const add = (title: string) => activity(workspaceId, c.opportunity.id, user.id, step, title);
  if (step === "RESEARCH") {
    await prisma.$transaction([
      prisma.researchRun.create({ data: { workspaceId, targetType: "COMPANY", targetId: c.companyId, status: "COMPLETED", provider: "guided-simulation", summary: "Known fictional facts: three locations; approximately 28 employees; inquiries arrive through web forms, calls, and referrals; follow-up depends on front-desk staff and is inconsistent. Assumptions: inquiries are not systematically reactivated, leadership reporting is limited, and follow-up varies by location.", sources: [{ type: "guided_scenario", scenarioId: GUIDED_SCENARIO_ID }], insights: { facts: ["Three dental locations", "Approximately 28 employees", "Web forms, calls, and referrals create inquiries", "Front-desk staff own follow-up"], assumptions: ["No systematic reactivation", "Limited leadership reporting", "Process varies by location"], questions: ["Monthly inquiry volume?", "First-response time?", "Number of contact attempts?", "Conversion by location?", "Current practice-management tools?", "Staff handoff process?"] } } }), add("Example research completed")
    ]);
  } else if (step === "QUALIFIED") {
    const rationale = { score: 78, status: "QUALIFIED", inputs: { problemSeverity: "HIGH", urgency: "MEDIUM_HIGH", authority: "PRIMARY_OWNER_INVOLVED", budget: "NOT_CONFIRMED", timing: "30_45_DAYS", solutionFit: "STRONG", risk: "Staff adoption and unclear baseline metrics" }, explanation: "78/100: severity 20, urgency 14, authority 18, timing 12, fit 18, budget 4, risk adjustment -8. Qualified with budget confirmation required." };
    await prisma.$transaction([prisma.lead.update({ where: { id: c.leadId }, data: { score: 78, status: "QUALIFIED" } }), prisma.note.create({ data: { workspaceId, relatedType: "Opportunity", relatedId: c.opportunity.id, body: JSON.stringify(rationale), createdById: user.id } }), add("Opportunity qualified with explainable score")]);
  } else if (step === "OUTREACH_DRAFT") {
    const campaign = await prisma.outreachCampaign.create({ data: { workspaceId, name: "Summit Dental discovery outreach [SIMULATED]", description: `${GUIDED_SCENARIO_ID} · Objective: discovery call · CTA: 30-minute conversation · approval required`, status: "ARCHIVED", createdById: user.id, steps: { create: [
      { workspaceId, position: 0, name: "Initial message", description: "Hi Dr. Chen — teams often find it difficult to follow up consistently with new-patient inquiries. We help practices design a manageable reactivation and follow-up workflow. Would a short discovery conversation next week be useful?" },
      { workspaceId, position: 1, name: "Follow-up 1", description: "I wanted to follow up in case improving inquiry response consistency is a priority. Open to a brief conversation?" },
      { workspaceId, position: 2, name: "Follow-up 2", description: "Last note from me. If a one-location pilot for inquiry follow-up is worth exploring, I would be glad to compare workflows." }
    ] } } });
    await prisma.$transaction([prisma.leadOutreachStatus.create({ data: { workspaceId, leadId: c.leadId, campaignId: campaign.id, status: "NOT_STARTED", notes: "SIMULATED draft; no sender or provider transport", updatedById: user.id } }), add("Outreach draft created")]);
  } else if (step === "OUTREACH_APPROVED") {
    const campaign = await prisma.outreachCampaign.findFirstOrThrow({ where: { workspaceId, description: { contains: GUIDED_SCENARIO_ID } } });
    await prisma.$transaction([prisma.outreachCampaign.update({ where: { id: campaign.id }, data: { status: "ACTIVE" } }), prisma.leadOutreachStatus.updateMany({ where: { workspaceId, campaignId: campaign.id, leadId: c.leadId }, data: { status: "QUEUED", notes: "Approved for guided simulation only", updatedById: user.id } }), add("Outreach approved")]);
  } else if (step === "SEND_SIMULATED") {
    const campaign = await prisma.outreachCampaign.findFirstOrThrow({ where: { workspaceId, status: "ACTIVE", description: { contains: GUIDED_SCENARIO_ID } }, include: { steps: { orderBy: { position: "asc" }, take: 1 } } });
    const send = await prisma.emailSend.create({ data: { workspaceId, contactId: c.contactId, email: "maya.chen@summit-dental.example", subject: "A manageable follow-up workflow", bodyHash: `SIMULATED:${GUIDED_SCENARIO_ID}`, status: "BLOCKED_COMPLIANCE", blockReason: "GUIDED_SIMULATION_NO_PROVIDER_CALL" } });
    await prisma.$transaction([prisma.emailEvent.create({ data: { workspaceId, emailSendId: send.id, eventType: "SIMULATED_SEND", safeSummary: { scenarioId: GUIDED_SCENARIO_ID, campaignId: campaign.id, delivered: false, providerCalled: false } } }), prisma.leadOutreachStatus.updateMany({ where: { workspaceId, leadId: c.leadId, campaignId: campaign.id }, data: { status: "SENT", notes: "Simulated send only; not delivered" } }), add("Send recorded without delivery")]);
  } else if (step === "REPLY_SIMULATED") {
    await prisma.$transaction([prisma.communicationLog.create({ data: { workspaceId, channel: "EMAIL_SIMULATION", direction: "INBOUND", subject: "Simulated reply", body: "[Simulated] Thanks for reaching out. We have been looking for a better way to follow up with new-patient inquiries. I’d be open to a quick conversation next week.", relatedType: "Opportunity", relatedId: c.opportunity.id, createdById: user.id } }), prisma.leadOutreachStatus.updateMany({ where: { workspaceId, leadId: c.leadId }, data: { status: "REPLIED", notes: "Simulated positive reply" } }), prisma.customerNotificationIntent.create({ data: { userId: user.id, recipient: user.email, templateKey: "SIMULATED_OUTREACH_REPLY", metadata: { scenarioId: GUIDED_SCENARIO_ID, opportunityId: c.opportunity.id, emailSent: false } } }), add("Positive reply received")]);
  } else if (step === "MEETING_SCHEDULED") {
    const future = new Date(Date.now() + 7 * 86400000); future.setUTCHours(15, 0, 0, 0);
    await prisma.$transaction([prisma.callSession.create({ data: { workspaceId, leadId: c.leadId, contactId: c.contactId, companyId: c.companyId, opportunityId: c.opportunity.id, provider: "OTHER", meetingUrl: `internal-simulation://${GUIDED_SCENARIO_ID}`, callDate: future, status: "SCHEDULED", transcriptSource: "Guided simulation · 30-minute discovery · agenda: inquiry sources, follow-up process, pilot goals", createdById: user.id } }), add("Internal discovery meeting scheduled")]);
  } else if (step === "MEETING_COMPLETED") {
    const call = await prisma.callSession.findFirstOrThrow({ where: { workspaceId, opportunityId: c.opportunity.id, meetingUrl: { contains: GUIDED_SCENARIO_ID } }, orderBy: { createdAt: "desc" } });
    const transcript = "[SIMULATED DISCOVERY CALL — NOT A REAL MEETING]\nAlex: How do inquiries arrive?\nMaya: Through web forms, calls, and referrals. Front-desk staff handle follow-up, but it often stops after one attempt.\nMaya: We do not have consistent reporting on unconverted inquiries. We want measurable improvement without overwhelming staff.\nMaya: A pilot at one location makes sense, with a target in 30–45 days. Please send a proposal with scope, timeline, and workflow.";
    const diagnostic = await prisma.diagnosticSession.create({ data: { workspaceId, title: "Summit Dental simulated discovery", status: "TRANSCRIPT_READY", relatedType: "Opportunity", relatedId: c.opportunity.id, callSessionId: call.id, summary: "Simulated discovery notes; no provider meeting occurred.", createdById: user.id } });
    await prisma.$transaction([prisma.callSession.update({ where: { id: call.id }, data: { status: "COMPLETED", transcriptText: transcript, transcriptSource: `SIMULATED:${GUIDED_SCENARIO_ID}` } }), prisma.transcript.create({ data: { workspaceId, sessionId: diagnostic.id, content: transcript, source: `SIMULATED:${GUIDED_SCENARIO_ID}`, discoveryNotes: "One-location pilot; measurable improvement; manageable staff workload; proposal requested.", createdById: user.id } }), add("Simulated discovery meeting completed")]);
  } else if (step === "ANALYSIS_CREATED") {
    const diagnostic = await prisma.diagnosticSession.findFirstOrThrow({ where: { workspaceId, relatedType: "Opportunity", relatedId: c.opportunity.id }, orderBy: { createdAt: "desc" } });
    await prisma.$transaction([prisma.analysisRecord.create({ data: { workspaceId, sessionId: diagnostic.id, title: "Summit Dental discovery analysis [SIMULATED]", summary: "Summit Dental needs a measurable, staff-friendly follow-up pilot at one location within 30–45 days.", executiveNotes: "Facts: multiple inquiry channels, front-desk ownership, one-attempt inconsistency, no consistent reporting, pilot preference, proposal request. Assumptions: baseline volumes and budget remain unconfirmed.", observations: { painPoints: ["Inconsistent follow-up", "Limited reporting"], goals: ["Measurable improvement", "Manageable workload"], objections: ["Staff adoption"], buyingSignals: ["Requested proposal", "30–45 day target"], decisionCriteria: ["Pilot scope", "Reporting", "Staff handoff"], stakeholders: ["Dr. Maya Chen", "Front-desk team"], commitments: ["Review proposal"], recommendedSolution: "One-location lead reactivation and follow-up pilot", proposalInputs: { setupFee: 4500, monthlyFee: 2000 } }, risks: ["Budget unconfirmed", "Baseline metrics unclear", "Staff adoption"], status: "NEEDS_REVIEW", createdById: user.id } }), add("Meeting analysis created")]);
  } else if (step === "ANALYSIS_APPROVED") {
    const analysis = await prisma.analysisRecord.findFirstOrThrow({ where: { workspaceId, title: { contains: "Summit Dental" } }, orderBy: { createdAt: "desc" } });
    await prisma.$transaction([prisma.analysisRecord.update({ where: { id: analysis.id }, data: { status: "REVIEWED", reviewedAt: new Date(), reviewedById: user.id } }), add("Analysis approved")]);
  } else if (step === "PROPOSAL_CREATED") {
    const analysis = await prisma.analysisRecord.findFirstOrThrow({ where: { workspaceId, status: "REVIEWED", title: { contains: "Summit Dental" } } });
    const content = { executiveSummary: "A one-location pilot to improve consistent follow-up on new-patient inquiries.", currentSituation: "Inquiries arrive through web forms, calls, and referrals; follow-up and reporting are inconsistent.", goals: ["Improve contact consistency", "Measure outcomes", "Avoid staff overload"], recommendedSolution: "AI-assisted lead reactivation, partnership development, and appointment follow-up workflow", pilotScope: "One Summit Dental location", implementationPlan: ["Discovery and baseline", "Build and QA", "Pilot launch", "Results review"], responsibilities: { northstar: "Workflow, messaging, reporting and optimization", summit: "Access, approvals, staff handoff and feedback" }, timeline: "30–45 days", deliverables: ["Intake workflow", "Follow-up sequence", "Reporting dashboard", "Pilot review"], pricing: { proposedSetupFee: 4500, proposedMonthlyFee: 2000, paid: 0, invoiced: 0 }, assumptions: ["Volumes and tool access confirmed during onboarding"], successMeasures: ["Response rate", "Appointments recovered", "Staff adoption"], nextSteps: "Approve scope and agreement" };
    await prisma.$transaction([prisma.proposal.create({ data: { workspaceId, opportunityId: c.opportunity.id, analysisId: analysis.id, companyId: c.companyId, title: "Summit Dental Follow-Up Pilot Proposal [SIMULATED]", content, status: "DRAFT", createdById: user.id } }), add("Proposal draft generated")]);
  } else if (step === "PROPOSAL_SHARED" || step === "PROPOSAL_ACCEPTED") {
    const proposal = await prisma.proposal.findFirstOrThrow({ where: { workspaceId, opportunityId: c.opportunity.id }, orderBy: { createdAt: "desc" } });
    await prisma.$transaction([prisma.proposal.update({ where: { id: proposal.id }, data: step === "PROPOSAL_SHARED" ? { status: "REVIEWED", reviewedAt: new Date(), reviewedById: user.id } : { status: "FINAL", finalizedAt: new Date(), finalizedById: user.id } }), add(step === "PROPOSAL_SHARED" ? "Proposal share and view recorded" : "Proposal accepted explicitly")]);
  } else if (step === "CONTRACT_CREATED") {
    const proposal = await prisma.proposal.findFirstOrThrow({ where: { workspaceId, opportunityId: c.opportunity.id, status: "FINAL" } });
    const content = { simulationNotice: "Guided simulation only; not a legally binding external e-signature.", parties: ["Northstar Growth", "Summit Dental Group"], scope: "One-location inquiry follow-up pilot", fees: { setup: 4500, monthly: 2000 }, paymentTerms: "Due dates to be confirmed; no invoice or payment created", startDate: "To be agreed", responsibilities: "Provider builds and reports; client supplies access and approvals", confidentiality: "Mutual confidentiality draft", termAndTermination: "Month-to-month after setup; 30-day notice draft", signatureParties: ["Alex Morgan", "Dr. Maya Chen"] };
    await prisma.$transaction([prisma.contract.create({ data: { workspaceId, proposalId: proposal.id, title: "Summit Dental Pilot Agreement [SIMULATED]", content, status: "DRAFT" } }), add("Agreement generated")]);
  } else if (step === "AGREEMENT_COMPLETED") {
    const contract = await prisma.contract.findFirstOrThrow({ where: { workspaceId, proposalId: { not: null }, title: { contains: "Summit Dental" } } });
    await prisma.$transaction([prisma.contract.update({ where: { id: contract.id }, data: { status: "FINAL", content: { ...(contract.content as object), simulatedEvents: ["sent", "viewed", "subscriber_signature", "client_signature", "fully_executed"], simulationNotice: "Not a legally binding external e-signature." } } }), add("Agreement completion recorded")]);
  } else if (step === "OPPORTUNITY_WON") {
    await prisma.$transaction([prisma.opportunity.update({ where: { id: c.opportunity.id }, data: { status: "WON" } }), add("Opportunity marked won")]);
  } else if (step === "CLIENT_CONVERTED") {
    await convertWonOpportunityToClient(workspaceId, c.opportunity.id); await add("Client conversion completed");
  } else if (step === "ONBOARDING_CREATED") {
    const project = await prisma.implementationProject.findFirstOrThrow({ where: { workspaceId, opportunityId: c.opportunity.id } });
    const items = ["Agreement confirmed", "Primary contact confirmed", "[CUSTOMER] Access requested", "[CUSTOMER] Intake questionnaire sent", "[CUSTOMER] Intake completed", "Kickoff scheduled", "[CUSTOMER] Assets received", "Implementation started", "Initial review", "Launch", "First results review"];
    await prisma.$transaction([...items.map((title, index) => prisma.projectTask.create({ data: { workspaceId, projectId: project.id, title: `[ONBOARDING ${index + 1}/11] ${title}`, status: index < 2 ? "DONE" : "TODO", assigneeId: user.id, dueAt: new Date(Date.now() + (index + 1) * 86400000) } })), add("Client onboarding checklist created")]);
  } else if (step === "DELIVERY_PLAN_CREATED") {
    const project = await prisma.implementationProject.findFirstOrThrow({ where: { workspaceId, opportunityId: c.opportunity.id } });
    const phases = [{ name: "Discovery and setup", tasks: ["Confirm lead sources", "Map current follow-up", "Define pilot location", "Request access", "Define baseline"] }, { name: "Build", tasks: ["Configure lead intake workflow", "Configure follow-up sequence", "Define staff handoff", "Configure reporting", "Complete QA"] }, { name: "Pilot launch", tasks: ["Launch at one location", "Monitor responses", "Review staff adoption", "Refine messaging"] }, { name: "Review", tasks: ["Compare baseline", "Present initial results", "Recommend expansion"] }];
    await prisma.$transaction(async tx => { for (const [position, phase] of phases.entries()) { const milestone = await tx.projectMilestone.create({ data: { workspaceId, projectId: project.id, name: phase.name, position } }); await tx.projectTask.createMany({ data: phase.tasks.map(title => ({ workspaceId, projectId: project.id, milestoneId: milestone.id, title })) }); } await tx.implementationProject.update({ where: { id: project.id }, data: { status: "ACTIVE", summary: "Four-phase Summit Dental guided delivery plan" } }); await tx.activity.create({ data: { workspaceId, type: marker(step), title: "Example delivery plan created (simulated)", description: GUIDED_SCENARIO_ID, relatedType: "Opportunity", relatedId: c.opportunity.id, createdById: user.id } }); });
  } else if (step === "DELIVERABLE_CREATED") {
    const analysis = await prisma.analysisRecord.findFirstOrThrow({ where: { workspaceId, title: { contains: "Summit Dental" } } });
    await prisma.$transaction([prisma.executiveReport.create({ data: { workspaceId, analysisId: analysis.id, opportunityId: c.opportunity.id, companyId: c.companyId, contactId: c.contactId, leadId: c.leadId, title: "Summit Dental Pilot Workflow and Follow-Up Plan [SIMULATED]", sections: [{ title: "Executive summary", body: "One-location pilot plan" }, { title: "Current process", body: "Front-desk follow-up across web, phone and referrals" }, { title: "Pilot workflow", body: "Capture, attempt sequence, handoff, outcome" }, { title: "Message sequence", body: "Editable initial and follow-up messages" }, { title: "Staff handoff", body: "Escalate positive responses to staff" }, { title: "Measurement plan", body: "Baseline, response, appointment and adoption measures" }, { title: "Launch checklist", body: "Access, QA, staff briefing, launch and review" }], status: "REVIEWED", reviewedAt: new Date(), reviewedById: user.id, createdById: user.id } }), add("First deliverable submitted for client review")]);
  } else if (step === "DELIVERABLE_APPROVED") {
    const report = await prisma.executiveReport.findFirstOrThrow({ where: { workspaceId, opportunityId: c.opportunity.id, title: { contains: "Pilot Workflow" } } });
    const project = await prisma.implementationProject.findFirstOrThrow({ where: { workspaceId, opportunityId: c.opportunity.id } });
    await prisma.$transaction([prisma.executiveReport.update({ where: { id: report.id }, data: { status: "FINAL", finalizedAt: new Date(), finalizedById: user.id } }), prisma.projectTask.create({ data: { workspaceId, projectId: project.id, title: "[DELIVERABLE] Pilot workflow approved by client (simulated)", status: "DONE", assigneeId: user.id } }), add("Client approved first deliverable")]);
  }
  return { step, opportunityId: c.opportunity.id };
}

export async function resetExampleJourney(workspaceId: string) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const exists = await prisma.activity.count({ where: { workspaceId, type: "SIMULATION_SCENARIO_CREATED", description: GUIDED_SCENARIO_ID } });
  if (!exists) return { reset: false };
  const c = await context(workspaceId);
  await prisma.$transaction(async tx => {
    const projects = await tx.implementationProject.findMany({ where: { workspaceId, opportunityId: c.opportunity.id }, select: { id: true } }); const projectIds = projects.map(p => p.id);
    await tx.executiveReport.deleteMany({ where: { workspaceId, opportunityId: c.opportunity.id } });
    await tx.contract.deleteMany({ where: { workspaceId, title: { contains: "Summit Dental" } } }); await tx.proposal.deleteMany({ where: { workspaceId, opportunityId: c.opportunity.id } });
    const diagnostics = await tx.diagnosticSession.findMany({ where: { workspaceId, relatedType: "Opportunity", relatedId: c.opportunity.id }, select: { id: true } }); await tx.analysisRecord.deleteMany({ where: { workspaceId, sessionId: { in: diagnostics.map(d => d.id) } } }); await tx.diagnosticSession.deleteMany({ where: { workspaceId, id: { in: diagnostics.map(d => d.id) } } });
    await tx.callSession.deleteMany({ where: { workspaceId, opportunityId: c.opportunity.id } }); await tx.researchRun.deleteMany({ where: { workspaceId, targetId: c.companyId } });
    await tx.implementationProject.deleteMany({ where: { workspaceId, id: { in: projectIds } } }); await tx.client.deleteMany({ where: { workspaceId, companyId: c.companyId } });
    const sends = await tx.emailSend.findMany({ where: { workspaceId, bodyHash: `SIMULATED:${GUIDED_SCENARIO_ID}` }, select: { id: true } }); await tx.emailEvent.deleteMany({ where: { workspaceId, emailSendId: { in: sends.map(send => send.id) } } }); await tx.emailSend.deleteMany({ where: { workspaceId, id: { in: sends.map(send => send.id) } } });
    await tx.outreachCampaign.deleteMany({ where: { workspaceId, description: { contains: GUIDED_SCENARIO_ID } } }); await tx.communicationLog.deleteMany({ where: { workspaceId, relatedType: "Opportunity", relatedId: c.opportunity.id } }); await tx.note.deleteMany({ where: { workspaceId, relatedType: "Opportunity", relatedId: c.opportunity.id } }); await tx.customerNotificationIntent.deleteMany({ where: { userId: user.id, templateKey: "SIMULATED_OUTREACH_REPLY" } });
    await tx.opportunity.delete({ where: { id: c.opportunity.id } }); await tx.lead.delete({ where: { id: c.leadId } }); await tx.contact.delete({ where: { id: c.contactId } }); await tx.company.delete({ where: { id: c.companyId } }); await tx.activity.deleteMany({ where: { workspaceId, relatedId: c.opportunity.id } });
    await tx.auditLog.create({ data: { workspaceId, action: "guided_scenario.reset", entityType: "GuidedScenario", entityId: GUIDED_SCENARIO_ID, actorId: user.id, metadata: { providerCalled: false } } });
  }); return { reset: true };
}
