import { notFound, redirect } from "next/navigation";
import { Prisma, type RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit/service";
import { companySchema, contactSchema, leadSchema, opportunitySchema } from "@/lib/validation/schemas";

type CrmType = "Company" | "Contact" | "Lead" | "Opportunity";
type CrmSlug = "companies" | "contacts" | "leads" | "opportunities";
export type RelatedType = CrmType | "DiagnosticSession" | "AnalysisRecord";

function emptyToUndefined<T>(value: T | "" | undefined): T | undefined { return value === "" ? undefined : value; }
function toMoney(value: number | "" | undefined) { return value === "" || value === undefined ? undefined : new Prisma.Decimal(value); }
function toDate(value: string | "" | undefined) { return value ? new Date(value) : undefined; }

async function assertCompany(workspaceId: string, id?: string) { if (!id) return; const count = await prisma.company.count({ where: { id, workspaceId } }); if (!count) throw new Error("Selected company is not available in this workspace."); }
async function assertContact(workspaceId: string, id?: string) { if (!id) return; const count = await prisma.contact.count({ where: { id, workspaceId } }); if (!count) throw new Error("Selected contact is not available in this workspace."); }
async function assertLead(workspaceId: string, id?: string) { if (!id) return; const count = await prisma.lead.count({ where: { id, workspaceId } }); if (!count) throw new Error("Selected lead is not available in this workspace."); }
async function assertPipeline(workspaceId: string, id?: string) { if (!id) return; const count = await prisma.pipeline.count({ where: { id, workspaceId } }); if (!count) throw new Error("Selected pipeline is not available in this workspace."); }
async function assertStage(workspaceId: string, id?: string) { if (!id) return; const count = await prisma.pipelineStage.count({ where: { id, workspaceId } }); if (!count) throw new Error("Selected stage is not available in this workspace."); }

export async function getCrmOverview(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId);
  const [companies, contacts, leads, opportunities, tasks] = await Promise.all([
    prisma.company.count({ where: { workspaceId, status: "ACTIVE" } }), prisma.contact.count({ where: { workspaceId, status: "ACTIVE" } }),
    prisma.lead.count({ where: { workspaceId, status: { not: "ARCHIVED" } } }), prisma.opportunity.count({ where: { workspaceId, status: "OPEN" } }),
    prisma.task.count({ where: { workspaceId, status: { in: ["TODO", "IN_PROGRESS"] } } })
  ]);
  return { companies, contacts, leads, opportunities, tasks };
}

export async function listCompanies(workspaceId: string) { await requireWorkspaceAccess(workspaceId); return prisma.company.findMany({ where: { workspaceId }, include: { contacts: true, opportunities: true }, orderBy: { updatedAt: "desc" } }); }
export async function listContacts(workspaceId: string) { await requireWorkspaceAccess(workspaceId); return prisma.contact.findMany({ where: { workspaceId }, include: { company: true, opportunities: true }, orderBy: { updatedAt: "desc" } }); }
export async function listLeads(workspaceId: string) { await requireWorkspaceAccess(workspaceId); return prisma.lead.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } }); }
export async function listOpportunities(workspaceId: string) { await requireWorkspaceAccess(workspaceId); return prisma.opportunity.findMany({ where: { workspaceId }, include: { company: true, contact: true, pipeline: true, stage: true }, orderBy: { updatedAt: "desc" } }); }

export async function getCompanyDetail(workspaceId: string, id: string) { await requireWorkspaceAccess(workspaceId); const record = await prisma.company.findFirst({ where: { id, workspaceId }, include: { contacts: true, opportunities: true } }); if (!record) notFound(); return record; }
export async function getContactDetail(workspaceId: string, id: string) { await requireWorkspaceAccess(workspaceId); const record = await prisma.contact.findFirst({ where: { id, workspaceId }, include: { company: true, opportunities: true } }); if (!record) notFound(); return record; }
export async function getLeadDetail(workspaceId: string, id: string) { await requireWorkspaceAccess(workspaceId); const record = await prisma.lead.findFirst({ where: { id, workspaceId } }); if (!record) notFound(); return record; }
export async function getOpportunityDetail(workspaceId: string, id: string) { await requireWorkspaceAccess(workspaceId); const record = await prisma.opportunity.findFirst({ where: { id, workspaceId }, include: { company: true, contact: true, pipeline: true, stage: true } }); if (!record) notFound(); return record; }

export async function getCrmRecordContext(workspaceId: string, relatedType?: string | null, relatedId?: string | null) {
  if (!relatedType || !relatedId) return null;
  await requireWorkspaceAccess(workspaceId);
  if (relatedType === "Company") return prisma.company.findFirst({ where: { id: relatedId, workspaceId }, select: { id: true, name: true, domain: true, industry: true, status: true } });
  if (relatedType === "Contact") return prisma.contact.findFirst({ where: { id: relatedId, workspaceId }, select: { id: true, firstName: true, lastName: true, email: true, title: true, status: true, company: { select: { id: true, name: true } } } });
  if (relatedType === "Lead") return prisma.lead.findFirst({ where: { id: relatedId, workspaceId }, select: { id: true, name: true, email: true, source: true, status: true, score: true } });
  if (relatedType === "Opportunity") return prisma.opportunity.findFirst({ where: { id: relatedId, workspaceId }, select: { id: true, name: true, amount: true, status: true, closeDate: true, company: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true } } } });
  return null;
}

export async function createCompany(workspaceId: string, input: unknown) { const { user } = await requireWorkspaceAccess(workspaceId); const data = companySchema.parse(input); const record = await prisma.company.create({ data: { name: data.name, domain: emptyToUndefined(data.domain), industry: emptyToUndefined(data.industry), employeeCount: emptyToUndefined(data.employeeCount), annualRevenue: toMoney(data.annualRevenue), workspaceId, createdById: user.id } }); await audit(workspaceId, "create", "Company", record.id, user.id); return record; }
export async function createContact(workspaceId: string, input: unknown) { const { user } = await requireWorkspaceAccess(workspaceId); const data = contactSchema.parse(input); const companyId = emptyToUndefined(data.companyId); await assertCompany(workspaceId, companyId); const record = await prisma.contact.create({ data: { firstName: data.firstName, lastName: data.lastName, email: emptyToUndefined(data.email), phone: emptyToUndefined(data.phone), title: emptyToUndefined(data.title), companyId, workspaceId, createdById: user.id } }); await audit(workspaceId, "create", "Contact", record.id, user.id); return record; }
export async function createLead(workspaceId: string, input: unknown) { const { user } = await requireWorkspaceAccess(workspaceId); const data = leadSchema.parse(input); const companyId = emptyToUndefined(data.companyId); const contactId = emptyToUndefined(data.contactId); await assertCompany(workspaceId, companyId); await assertContact(workspaceId, contactId); const record = await prisma.lead.create({ data: { name: data.name, email: emptyToUndefined(data.email), source: emptyToUndefined(data.source), companyId, contactId, score: emptyToUndefined(data.score), workspaceId, createdById: user.id } }); await audit(workspaceId, "create", "Lead", record.id, user.id); return record; }
export async function createOpportunity(workspaceId: string, input: unknown) { const { user } = await requireWorkspaceAccess(workspaceId); const data = opportunitySchema.parse(input); const companyId = emptyToUndefined(data.companyId); const contactId = emptyToUndefined(data.contactId); const leadId = emptyToUndefined(data.leadId); const pipelineId = emptyToUndefined(data.pipelineId); const stageId = emptyToUndefined(data.stageId); await Promise.all([assertCompany(workspaceId, companyId), assertContact(workspaceId, contactId), assertLead(workspaceId, leadId), assertPipeline(workspaceId, pipelineId), assertStage(workspaceId, stageId)]); const record = await prisma.opportunity.create({ data: { name: data.name, amount: toMoney(data.amount), closeDate: toDate(data.closeDate), companyId, contactId, leadId, pipelineId, stageId, workspaceId, createdById: user.id } }); await audit(workspaceId, "create", "Opportunity", record.id, user.id); return record; }

export async function updateCompany(workspaceId: string, id: string, input: unknown) { const { user } = await requireWorkspaceAccess(workspaceId); await getCompanyDetail(workspaceId, id); const data = companySchema.parse(input); const record = await prisma.company.update({ where: { id }, data: { name: data.name, domain: emptyToUndefined(data.domain), industry: emptyToUndefined(data.industry), employeeCount: emptyToUndefined(data.employeeCount), annualRevenue: toMoney(data.annualRevenue) } }); await audit(workspaceId, "update", "Company", id, user.id); return record; }
export async function updateContact(workspaceId: string, id: string, input: unknown) { const { user } = await requireWorkspaceAccess(workspaceId); await getContactDetail(workspaceId, id); const data = contactSchema.parse(input); const companyId = emptyToUndefined(data.companyId); await assertCompany(workspaceId, companyId); const record = await prisma.contact.update({ where: { id }, data: { firstName: data.firstName, lastName: data.lastName, email: emptyToUndefined(data.email), phone: emptyToUndefined(data.phone), title: emptyToUndefined(data.title), companyId } }); await audit(workspaceId, "update", "Contact", id, user.id); return record; }
export async function updateLead(workspaceId: string, id: string, input: unknown) { const { user } = await requireWorkspaceAccess(workspaceId); await getLeadDetail(workspaceId, id); const data = leadSchema.parse(input); const companyId = emptyToUndefined(data.companyId); const contactId = emptyToUndefined(data.contactId); await assertCompany(workspaceId, companyId); await assertContact(workspaceId, contactId); const record = await prisma.lead.update({ where: { id }, data: { name: data.name, email: emptyToUndefined(data.email), source: emptyToUndefined(data.source), companyId, contactId, score: emptyToUndefined(data.score) } }); await audit(workspaceId, "update", "Lead", id, user.id); return record; }
export async function updateOpportunity(workspaceId: string, id: string, input: unknown) { const { user } = await requireWorkspaceAccess(workspaceId); await getOpportunityDetail(workspaceId, id); const data = opportunitySchema.parse(input); const companyId = emptyToUndefined(data.companyId); const contactId = emptyToUndefined(data.contactId); const leadId = emptyToUndefined(data.leadId); const pipelineId = emptyToUndefined(data.pipelineId); const stageId = emptyToUndefined(data.stageId); await Promise.all([assertCompany(workspaceId, companyId), assertContact(workspaceId, contactId), assertLead(workspaceId, leadId), assertPipeline(workspaceId, pipelineId), assertStage(workspaceId, stageId)]); const record = await prisma.opportunity.update({ where: { id }, data: { name: data.name, amount: toMoney(data.amount), closeDate: toDate(data.closeDate), companyId, contactId, leadId, pipelineId, stageId } }); await audit(workspaceId, "update", "Opportunity", id, user.id); return record; }

export async function archiveCrmRecord(workspaceId: string, type: CrmSlug, id: string) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  if (type === "companies") { await getCompanyDetail(workspaceId, id); await prisma.company.update({ where: { id }, data: { status: "ARCHIVED" satisfies RecordStatus } }); await audit(workspaceId, "archive", "Company", id, user.id); redirect("/dashboard/companies"); }
  if (type === "contacts") { await getContactDetail(workspaceId, id); await prisma.contact.update({ where: { id }, data: { status: "ARCHIVED" satisfies RecordStatus } }); await audit(workspaceId, "archive", "Contact", id, user.id); redirect("/dashboard/contacts"); }
  if (type === "leads") { await getLeadDetail(workspaceId, id); await prisma.lead.update({ where: { id }, data: { status: "ARCHIVED" } }); await audit(workspaceId, "archive", "Lead", id, user.id); redirect("/dashboard/leads"); }
  await getOpportunityDetail(workspaceId, id); await prisma.opportunity.update({ where: { id }, data: { status: "ARCHIVED" } }); await audit(workspaceId, "archive", "Opportunity", id, user.id); redirect("/dashboard/opportunities");
}

export async function listPipeline(workspaceId: string) { await requireWorkspaceAccess(workspaceId); return prisma.pipeline.findMany({ where: { workspaceId, status: "ACTIVE" }, include: { stages: { orderBy: { position: "asc" } }, opportunities: true } }); }
