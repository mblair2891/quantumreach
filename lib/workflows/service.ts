import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit/service";
import { callSessionSchema, outreachCampaignSchema, outreachLeadAssignmentSchema, outreachStatusSchema } from "@/lib/validation/schemas";

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
  return prisma.callSession.findMany({ where: { workspaceId }, include: { lead: true, company: true, contact: true, opportunity: true }, orderBy: { updatedAt: "desc" } });
}

export async function createCallSession(workspaceId: string, input: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const data = callSessionSchema.parse(input);
  const leadId = empty(data.leadId);
  const contactId = empty(data.contactId);
  const companyId = empty(data.companyId);
  const opportunityId = empty(data.opportunityId);
  await Promise.all([assertLead(workspaceId, leadId), assertContact(workspaceId, contactId), assertCompany(workspaceId, companyId), assertOpportunity(workspaceId, opportunityId)]);
  const call = await prisma.callSession.create({ data: { workspaceId, leadId, contactId, companyId, opportunityId, provider: data.provider, meetingUrl: empty(data.meetingUrl), recordingUrl: empty(data.recordingUrl), transcriptText: empty(data.transcriptText), transcriptSource: empty(data.transcriptSource), callDate: date(data.callDate), status: data.transcriptText ? "TRANSCRIPT_READY" : data.status, createdById: user.id } });
  await audit(workspaceId, "call_session.created", "CallSession", call.id, user.id);
  if (data.transcriptText) await audit(workspaceId, "call_session.transcript_added", "CallSession", call.id, user.id);
  return call;
}

export async function createDiagnosticFromCallSession(workspaceId: string, callSessionId: string) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const call = await prisma.callSession.findFirst({ where: { id: callSessionId, workspaceId } });
  if (!call) notFound();
  if (!call.transcriptText) throw new Error("Transcript text is required before creating a diagnostic.");
  const relatedType = call.opportunityId ? "opportunity" : call.companyId ? "company" : call.contactId ? "contact" : call.leadId ? "lead" : null;
  const relatedId = call.opportunityId ?? call.companyId ?? call.contactId ?? call.leadId ?? null;
  const session = await prisma.diagnosticSession.create({ data: { workspaceId, title: `Diagnostic from ${call.provider} call`, status: "TRANSCRIPT_READY", relatedType, relatedId, callSessionId: call.id, createdById: user.id, transcripts: { create: { workspaceId, content: call.transcriptText, source: call.transcriptSource ?? "manual_call_session", createdById: user.id } } } });
  await prisma.callSession.update({ where: { id: call.id }, data: { status: "DIAGNOSTIC_CREATED" } });
  await audit(workspaceId, "diagnostic.created_from_call_session", "DiagnosticSession", session.id, user.id, { callSessionId: call.id });
  return session;
}
