import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit/service";
import { callSessionSchema, callTranscriptSchema, outreachCampaignSchema, outreachLeadAssignmentSchema, outreachStatusSchema } from "@/lib/validation/schemas";

function empty(value?: string | null) {
  return value ? value : undefined;
}

function date(value?: string | null) {
  return value ? new Date(value) : undefined;
}

async function assertLead(workspaceId: string, id?: string) {
  if (!id) return;
  if (!await prisma.lead.count({ where: { id, workspaceId } })) throw new Error("Lead is not available in this workspace.");
}

async function assertContact(workspaceId: string, id?: string) {
  if (!id) return;
  if (!await prisma.contact.count({ where: { id, workspaceId } })) throw new Error("Contact is not available in this workspace.");
}

async function assertCompany(workspaceId: string, id?: string) {
  if (!id) return;
  if (!await prisma.company.count({ where: { id, workspaceId } })) throw new Error("Company is not available in this workspace.");
}

async function assertOpportunity(workspaceId: string, id?: string) {
  if (!id) return;
  if (!await prisma.opportunity.count({ where: { id, workspaceId } })) throw new Error("Opportunity is not available in this workspace.");
}

async function assertCampaign(workspaceId: string, id?: string) {
  if (!id) return;
  if (!await prisma.outreachCampaign.count({ where: { id, workspaceId } })) throw new Error("Campaign is not available in this workspace.");
}

function relatedContext(call: { opportunityId?: string | null; companyId?: string | null; contactId?: string | null; leadId?: string | null }) {
  const relatedType = call.opportunityId ? "Opportunity" : call.companyId ? "Company" : call.contactId ? "Contact" : call.leadId ? "Lead" : null;
  const relatedId = call.opportunityId ?? call.companyId ?? call.contactId ?? call.leadId ?? null;
  return { relatedType, relatedId };
}

export async function listOutreachCampaigns(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId);
  return prisma.outreachCampaign.findMany({
    where: { workspaceId },
    include: { leadStatuses: true, steps: { orderBy: { position: "asc" } } },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getOutreachCampaignDetail(workspaceId: string, id: string) {
  await requireWorkspaceAccess(workspaceId);
  const campaign = await prisma.outreachCampaign.findFirst({
    where: { id, workspaceId },
    include: {
      leadStatuses: { include: { lead: true }, orderBy: { updatedAt: "desc" } },
      steps: { orderBy: { position: "asc" } }
    }
  });
  if (!campaign) notFound();
  return campaign;
}

export async function createOutreachCampaign(workspaceId: string, input: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const data = outreachCampaignSchema.parse(input);
  const campaign = await prisma.outreachCampaign.create({ data: { workspaceId, name: data.name, description: empty(data.description), createdById: user.id } });
  await audit(workspaceId, "outreach.campaign_created", "OutreachCampaign", campaign.id, user.id);
  return campaign;
}

export async function assignLeadToCampaign(workspaceId: string, campaignId: string, input: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const data = outreachLeadAssignmentSchema.parse(input);
  await Promise.all([assertCampaign(workspaceId, campaignId), assertLead(workspaceId, data.leadId)]);
  const existing = await prisma.leadOutreachStatus.findFirst({ where: { workspaceId, campaignId, leadId: data.leadId } });
  const status = existing ? await prisma.leadOutreachStatus.update({ where: { id: existing.id }, data: { notes: empty(data.notes), updatedById: user.id } }) : await prisma.leadOutreachStatus.create({ data: { workspaceId, leadId: data.leadId, campaignId, status: "NOT_STARTED", notes: empty(data.notes), updatedById: user.id } });
  await audit(workspaceId, "outreach.lead_assigned", "OutreachCampaign", campaignId, user.id, { leadId: data.leadId });
  return status;
}

export async function updateLeadOutreachStatus(workspaceId: string, leadId: string, input: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const data = outreachStatusSchema.parse(input);
  const campaignId = empty(data.campaignId);
  await Promise.all([assertLead(workspaceId, leadId), assertCampaign(workspaceId, campaignId)]);
  const existing = await prisma.leadOutreachStatus.findFirst({ where: { workspaceId, leadId, campaignId: campaignId ?? null } });
  const status = existing ? await prisma.leadOutreachStatus.update({ where: { id: existing.id }, data: { status: data.status, notes: empty(data.notes), updatedById: user.id } }) : await prisma.leadOutreachStatus.create({ data: { workspaceId, leadId, campaignId, status: data.status, notes: empty(data.notes), updatedById: user.id } });
  await audit(workspaceId, "outreach.status_updated", "Lead", leadId, user.id, { status: data.status, campaignId });
  return status;
}

export async function listCallSessions(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId);
  return prisma.callSession.findMany({
    where: { workspaceId },
    include: {
      lead: true,
      company: true,
      contact: true,
      opportunity: true,
      diagnostics: { orderBy: { updatedAt: "desc" }, take: 1, include: { analyses: { orderBy: { updatedAt: "desc" }, take: 1 } } }
    },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getCallSessionFormOptions(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId);
  const [leads, contacts, companies, opportunities] = await Promise.all([
    prisma.lead.findMany({ where: { workspaceId, status: { not: "ARCHIVED" } }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.contact.findMany({ where: { workspaceId, status: "ACTIVE" }, orderBy: { updatedAt: "desc" }, take: 100, include: { company: true } }),
    prisma.company.findMany({ where: { workspaceId, status: "ACTIVE" }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.opportunity.findMany({ where: { workspaceId, status: { not: "ARCHIVED" } }, orderBy: { updatedAt: "desc" }, take: 100, include: { company: true } })
  ]);
  return { leads, contacts, companies, opportunities };
}

export async function getCallSessionDetail(workspaceId: string, id: string) {
  await requireWorkspaceAccess(workspaceId);
  const call = await prisma.callSession.findFirst({
    where: { id, workspaceId },
    include: {
      lead: true,
      contact: { include: { company: true } },
      company: true,
      opportunity: { include: { company: true, contact: true } },
      meetingRoom: true,
      diagnostics: {
        orderBy: { updatedAt: "desc" },
        include: {
          transcripts: { orderBy: { updatedAt: "desc" }, take: 1 },
          analyzerRuns: { orderBy: { createdAt: "desc" }, take: 1 },
          analyses: {
            orderBy: { updatedAt: "desc" },
            take: 1,
            include: {
              reports: { orderBy: { updatedAt: "desc" } },
              roadmaps: { orderBy: { updatedAt: "desc" } },
              proposals: { orderBy: { updatedAt: "desc" } }
            }
          }
        }
      }
    }
  });
  if (!call) notFound();
  const activity = await prisma.auditLog.findMany({ where: { workspaceId, entityType: { in: ["CallSession", "DiagnosticSession"] }, OR: [{ entityId: call.id }, { metadata: { path: ["callSessionId"], equals: call.id } }] }, orderBy: { createdAt: "desc" }, take: 8 });
  const latestDiagnostic = call.diagnostics[0] ?? null;
  const latestAnalysis = latestDiagnostic?.analyses[0] ?? null;
  if (latestAnalysis && call.status === "DIAGNOSTIC_CREATED") await prisma.callSession.update({ where: { id: call.id }, data: { status: "ANALYZED" } });
  return { call, latestDiagnostic, latestAnalysis, activity };
}

export async function createCallSession(workspaceId: string, input: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const data = callSessionSchema.parse(input);
  const leadId = empty(data.leadId);
  const contactId = empty(data.contactId);
  const companyId = empty(data.companyId);
  const opportunityId = empty(data.opportunityId);
  await Promise.all([assertLead(workspaceId, leadId), assertContact(workspaceId, contactId), assertCompany(workspaceId, companyId), assertOpportunity(workspaceId, opportunityId)]);
  const transcriptText = empty(data.transcriptText);
  const call = await prisma.callSession.create({ data: { workspaceId, leadId, contactId, companyId, opportunityId, provider: data.provider, meetingUrl: empty(data.meetingUrl), recordingUrl: empty(data.recordingUrl), transcriptText, transcriptSource: empty(data.transcriptSource), callDate: date(data.callDate), status: transcriptText ? "TRANSCRIPT_READY" : data.status, createdById: user.id } });
  await audit(workspaceId, "call_session.created", "CallSession", call.id, user.id, { provider: call.provider, status: call.status });
  const linked = { leadId, contactId, companyId, opportunityId };
  if (leadId || contactId || companyId || opportunityId) await audit(workspaceId, "call_session.crm_linked", "CallSession", call.id, user.id, linked);
  if (transcriptText) await audit(workspaceId, "call_session.transcript_added", "CallSession", call.id, user.id, { transcriptSource: call.transcriptSource, characterCount: transcriptText.length });
  return call;
}

export async function updateCallSession(workspaceId: string, id: string, input: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const existing = await prisma.callSession.findFirst({ where: { id, workspaceId } });
  if (!existing) notFound();
  const data = callSessionSchema.parse(input);
  const leadId = empty(data.leadId);
  const contactId = empty(data.contactId);
  const companyId = empty(data.companyId);
  const opportunityId = empty(data.opportunityId);
  await Promise.all([assertLead(workspaceId, leadId), assertContact(workspaceId, contactId), assertCompany(workspaceId, companyId), assertOpportunity(workspaceId, opportunityId)]);
  const transcriptText = empty(data.transcriptText);
  const status = transcriptText && ["SCHEDULED", "COMPLETED"].includes(data.status) ? "TRANSCRIPT_READY" : data.status;
  const call = await prisma.callSession.update({ where: { id }, data: { leadId, contactId, companyId, opportunityId, provider: data.provider, meetingUrl: empty(data.meetingUrl), recordingUrl: empty(data.recordingUrl), transcriptText, transcriptSource: empty(data.transcriptSource), callDate: date(data.callDate), status } });
  await audit(workspaceId, "call_session.updated", "CallSession", id, user.id, { provider: call.provider });
  if (existing.status !== call.status) await audit(workspaceId, "call_session.status_updated", "CallSession", id, user.id, { from: existing.status, to: call.status });
  if (existing.leadId !== leadId || existing.contactId !== contactId || existing.companyId !== companyId || existing.opportunityId !== opportunityId) await audit(workspaceId, "call_session.crm_linked", "CallSession", id, user.id, { leadId, contactId, companyId, opportunityId });
  if (existing.transcriptText !== transcriptText) await audit(workspaceId, "call_session.transcript_updated", "CallSession", id, user.id, { transcriptSource: call.transcriptSource, characterCount: transcriptText?.length ?? 0 });
  return call;
}

export async function updateCallStatus(workspaceId: string, id: string, status: string) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const existing = await prisma.callSession.findFirst({ where: { id, workspaceId } });
  if (!existing) notFound();
  const data = callSessionSchema.pick({ status: true }).parse({ status });
  const call = await prisma.callSession.update({ where: { id }, data: { status: data.status } });
  await audit(workspaceId, "call_session.status_updated", "CallSession", id, user.id, { from: existing.status, to: call.status });
  return call;
}

export async function saveCallTranscript(workspaceId: string, id: string, input: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const existing = await prisma.callSession.findFirst({ where: { id, workspaceId } });
  if (!existing) notFound();
  const data = callTranscriptSchema.parse(input);
  const transcriptText = empty(data.transcriptText);
  const call = await prisma.callSession.update({ where: { id }, data: { transcriptText, transcriptSource: empty(data.transcriptSource), status: transcriptText && ["SCHEDULED", "COMPLETED"].includes(existing.status) ? "TRANSCRIPT_READY" : existing.status } });
  await audit(workspaceId, existing.transcriptText ? "call_session.transcript_updated" : "call_session.transcript_added", "CallSession", id, user.id, { transcriptSource: call.transcriptSource, characterCount: transcriptText?.length ?? 0 });
  if (existing.status !== call.status) await audit(workspaceId, "call_session.status_updated", "CallSession", id, user.id, { from: existing.status, to: call.status });
  return call;
}

export async function createDiagnosticFromCallSession(workspaceId: string, callSessionId: string) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const call = await prisma.callSession.findFirst({ where: { id: callSessionId, workspaceId }, include: { diagnostics: { orderBy: { updatedAt: "desc" }, take: 1 } } });
  if (!call) notFound();
  if (!call.transcriptText) throw new Error("Transcript text is required before creating a diagnostic.");
  const existing = call.diagnostics[0];
  if (existing) return existing;
  const { relatedType, relatedId } = relatedContext(call);
  const session = await prisma.diagnosticSession.create({ data: { workspaceId, title: `Diagnostic from ${call.provider} call`, status: "TRANSCRIPT_READY", relatedType, relatedId, callSessionId: call.id, createdById: user.id, transcripts: { create: { workspaceId, content: call.transcriptText, source: call.transcriptSource ?? "manual_call_session", createdById: user.id } } } });
  await prisma.callSession.update({ where: { id: call.id }, data: { status: "DIAGNOSTIC_CREATED" } });
  await audit(workspaceId, "diagnostic.created_from_call_session", "DiagnosticSession", session.id, user.id, { callSessionId: call.id, relatedType, relatedId });
  await audit(workspaceId, "call_session.status_updated", "CallSession", call.id, user.id, { from: call.status, to: "DIAGNOSTIC_CREATED" });
  return session;
}

export type WorkflowAction = { title: string; detail: string; href: string; tone: "amber" | "blue" | "green" | "slate" };

function hasTranscriptFilter() {
  return { not: null } as const;
}

export async function getWorkflowStatusSummary(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId);
  const [
    leadsNotStarted,
    leadsInOutreach,
    leadsReplied,
    callsScheduled,
    callsNeedingTranscript,
    callsTranscriptReady,
    diagnosticsReadyForAnalysis,
    analysesNeedingReview,
    analysesReviewedFinal,
    reportsGenerated,
    roadmapsGenerated,
    proposalsGenerated,
    recentCalls,
    recentAudit,
    activeCampaigns,
    activeKnowledge,
    draftKnowledge,
    activeTestKnowledge,
    usedKnowledge
  ] = await Promise.all([
    prisma.lead.count({ where: { workspaceId, outreachStatuses: { none: {} }, status: { not: "ARCHIVED" } } }),
    prisma.leadOutreachStatus.count({ where: { workspaceId, status: { in: ["QUEUED", "SENT", "OPENED"] } } }),
    prisma.leadOutreachStatus.count({ where: { workspaceId, status: { in: ["REPLIED", "CALL_BOOKED", "CALL_COMPLETED", "TRANSCRIPT_READY", "ANALYZED"] } } }),
    prisma.callSession.count({ where: { workspaceId, status: "SCHEDULED" } }),
    prisma.callSession.count({ where: { workspaceId, status: "COMPLETED", transcriptText: null } }),
    prisma.callSession.count({ where: { workspaceId, transcriptText: hasTranscriptFilter(), diagnostics: { none: {} }, status: { not: "ARCHIVED" } } }),
    prisma.diagnosticSession.count({ where: { workspaceId, status: "TRANSCRIPT_READY", analyses: { none: {} } } }),
    prisma.analysisRecord.count({ where: { workspaceId, status: { in: ["DRAFT", "NEEDS_REVIEW"] } } }),
    prisma.analysisRecord.count({ where: { workspaceId, status: { in: ["REVIEWED", "FINAL"] } } }),
    prisma.executiveReport.count({ where: { workspaceId, status: { in: ["GENERATED", "REVIEWED", "FINAL"] } } }),
    prisma.strategicRoadmap.count({ where: { workspaceId, status: { in: ["GENERATED", "REVIEWED", "FINAL"] } } }),
    prisma.proposal.count({ where: { workspaceId, status: { in: ["GENERATED", "REVIEWED", "FINAL"] } } }),
    prisma.callSession.findMany({ where: { workspaceId }, include: { lead: true, opportunity: true, diagnostics: { include: { analyses: { include: { reports: true, roadmaps: true, proposals: true }, orderBy: { updatedAt: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" }, take: 5 }),
    prisma.auditLog.findMany({ where: { workspaceId }, select: { id: true, action: true, entityType: true, entityId: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.outreachCampaign.count({ where: { workspaceId, status: "ACTIVE" } }),
    prisma.knowledgeDocument.findMany({ where: { workspaceId, status: "ACTIVE" }, select: { title: true, authorityLevel: true, documentType: true, priority: true } }),
    prisma.knowledgeDocument.count({ where: { workspaceId, status: "DRAFT" } }),
    prisma.knowledgeDocument.count({ where: { workspaceId, status: "ACTIVE", title: { startsWith: "Test" } } }),
    prisma.knowledgeDocument.count({ where: { workspaceId, OR: [{ usages: { some: {} } }, { sourceReferences: { some: {} } }] } })
  ]);

  const countActive = (levels: string[]) => activeKnowledge.filter((doc) => levels.includes(doc.authorityLevel) || levels.includes(doc.documentType)).length;
  const knowledgeCoverage = {
    globalDoctrine: activeKnowledge.filter((doc) => doc.priority === "GLOBAL" && ["SYSTEM_DOCTRINE", "PRODUCT_DOCTRINE", "UX_COPY_DOCTRINE"].includes(doc.authorityLevel)).length,
    diagnosticFramework: countActive(["DIAGNOSTIC_FRAMEWORK"]),
    reportFramework: countActive(["REPORT_FRAMEWORK"]),
    roadmapFramework: countActive(["ROADMAP_FRAMEWORK"]),
    proposalFramework: countActive(["PROPOSAL_FRAMEWORK"]),
    executionHandoffFramework: countActive(["EXECUTION_HANDOFF"]),
    draftDocuments: draftKnowledge,
    activeTestDocuments: activeTestKnowledge,
    usedDocuments: usedKnowledge
  };
  const knowledgeCoverageWarnings = [
    knowledgeCoverage.globalDoctrine > 0 ? "Global doctrine active." : "No active global doctrine found.",
    knowledgeCoverage.diagnosticFramework === 0 ? "No active diagnostic framework found." : null,
    knowledgeCoverage.reportFramework === 0 ? "No active report framework found." : null,
    knowledgeCoverage.roadmapFramework === 0 ? "No active roadmap framework found." : null,
    knowledgeCoverage.proposalFramework === 0 ? "No active proposal framework found." : null,
    knowledgeCoverage.executionHandoffFramework === 0 ? "No active execution handoff framework found." : null,
    knowledgeCoverage.activeTestDocuments > 0 ? "Test source documents are active and may influence production outputs." : null,
    knowledgeCoverage.draftDocuments > 0 ? "Draft source documents need review." : null
  ].filter((warning): warning is string => Boolean(warning));

  const deliverablesGenerated = reportsGenerated + roadmapsGenerated + proposalsGenerated;
  const nextRecommendedActions: WorkflowAction[] = [];
  if (callsNeedingTranscript > 0) nextRecommendedActions.push({ title: `Add transcript to ${callsNeedingTranscript} completed call${callsNeedingTranscript === 1 ? "" : "s"}.`, detail: "Completed calls need transcript text before diagnostic creation.", href: "/dashboard/calls", tone: "amber" });
  if (callsTranscriptReady > 0) nextRecommendedActions.push({ title: `Create diagnostic from ${callsTranscriptReady} transcript-ready call${callsTranscriptReady === 1 ? "" : "s"}.`, detail: "A transcript is present and no diagnostic is linked yet.", href: "/dashboard/calls", tone: "blue" });
  if (diagnosticsReadyForAnalysis > 0) nextRecommendedActions.push({ title: `Run analysis on ${diagnosticsReadyForAnalysis} diagnostic${diagnosticsReadyForAnalysis === 1 ? "" : "s"}.`, detail: "Transcript-ready diagnostics are waiting for source-guided analysis.", href: "/dashboard/diagnostics", tone: "blue" });
  if (analysesNeedingReview > 0) nextRecommendedActions.push({ title: `Review ${analysesNeedingReview} analysis record${analysesNeedingReview === 1 ? "" : "s"}.`, detail: "Human review is required before reports, roadmaps, or proposals are production-ready.", href: "/dashboard/analysis", tone: "amber" });
  if (analysesReviewedFinal > deliverablesGenerated) nextRecommendedActions.push({ title: "Generate report, roadmap, or proposal from reviewed analysis.", detail: "Reviewed intelligence is ready for downstream deliverables.", href: "/dashboard/analysis", tone: "green" });
  if (knowledgeCoverage.reportFramework === 0) nextRecommendedActions.push({ title: "Activate a report framework before generating reports.", detail: "Report generation should use active production source-of-truth documents.", href: "/dashboard/knowledge", tone: "amber" });
  if (knowledgeCoverage.proposalFramework === 0) nextRecommendedActions.push({ title: "No active proposal framework found.", detail: "Activate proposal framework coverage before proposal generation.", href: "/dashboard/knowledge", tone: "amber" });
  if (knowledgeCoverage.activeTestDocuments > 0) nextRecommendedActions.push({ title: "Archive temporary test source documents.", detail: "Active documents whose title begins with Test may influence production outputs.", href: "/dashboard/knowledge?filter=test", tone: "amber" });
  if (nextRecommendedActions.length === 0) nextRecommendedActions.push({ title: "No immediate workflow blockers detected.", detail: "Continue moving leads through outreach, calls, analysis review, and deliverables.", href: "/dashboard/leads", tone: "slate" });

  const readinessChecklist = [
    { label: "Active global doctrine exists", complete: knowledgeCoverage.globalDoctrine > 0 },
    { label: "Active diagnostic framework exists", complete: knowledgeCoverage.diagnosticFramework > 0 },
    { label: "Active report framework exists", complete: knowledgeCoverage.reportFramework > 0 },
    { label: "Active roadmap framework exists", complete: knowledgeCoverage.roadmapFramework > 0 },
    { label: "Active proposal framework exists", complete: knowledgeCoverage.proposalFramework > 0 },
    { label: "At least one lead exists", complete: leadsNotStarted + leadsInOutreach + leadsReplied > 0 },
    { label: "At least one outreach campaign exists", complete: activeCampaigns > 0 },
    { label: "At least one call has transcript", complete: callsTranscriptReady > 0 || diagnosticsReadyForAnalysis > 0 || analysesNeedingReview > 0 || analysesReviewedFinal > 0 },
    { label: "At least one analysis has been reviewed", complete: analysesReviewedFinal > 0 },
    { label: "No temporary test documents are active", complete: knowledgeCoverage.activeTestDocuments === 0 },
    { label: "No major required setup missing", complete: knowledgeCoverage.globalDoctrine > 0 && knowledgeCoverage.diagnosticFramework > 0 && knowledgeCoverage.reportFramework > 0 && knowledgeCoverage.roadmapFramework > 0 && knowledgeCoverage.proposalFramework > 0 && knowledgeCoverage.activeTestDocuments === 0 }
  ];

  return { leadsNotStarted, leadsInOutreach, leadsReplied, callsScheduled, callsNeedingTranscript, callsTranscriptReady, diagnosticsReadyForAnalysis, analysesNeedingReview, analysesReviewedFinal, deliverablesGenerated, reportsGenerated, roadmapsGenerated, proposalsGenerated, activeCampaigns, recentCalls, recentAudit, knowledgeCoverage, knowledgeCoverageWarnings, nextRecommendedActions, readinessChecklist };
}
