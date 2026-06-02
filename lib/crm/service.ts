import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit/service";
import { companySchema, contactSchema, leadSchema, opportunitySchema } from "@/lib/validation/schemas";

export async function getCrmOverview(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId);
  const [companies, contacts, leads, opportunities, tasks] = await Promise.all([
    prisma.company.count({ where: { workspaceId, status: "ACTIVE" } }), prisma.contact.count({ where: { workspaceId, status: "ACTIVE" } }),
    prisma.lead.count({ where: { workspaceId, status: { not: "ARCHIVED" } } }), prisma.opportunity.count({ where: { workspaceId, status: "OPEN" } }),
    prisma.task.count({ where: { workspaceId, status: { in: ["TODO", "IN_PROGRESS"] } } })
  ]);
  return { companies, contacts, leads, opportunities, tasks };
}
export async function createCompany(workspaceId: string, input: unknown) { const { user } = await requireWorkspaceAccess(workspaceId); const data = companySchema.parse(input); const record = await prisma.company.create({ data: { ...data, workspaceId, createdById: user.id } }); await audit(workspaceId, "create", "Company", record.id, user.id); return record; }
export async function createContact(workspaceId: string, input: unknown) { const { user } = await requireWorkspaceAccess(workspaceId); const data = contactSchema.parse(input); const record = await prisma.contact.create({ data: { ...data, email: data.email || undefined, workspaceId, createdById: user.id } }); await audit(workspaceId, "create", "Contact", record.id, user.id); return record; }
export async function createLead(workspaceId: string, input: unknown) { const { user } = await requireWorkspaceAccess(workspaceId); const data = leadSchema.parse(input); const record = await prisma.lead.create({ data: { ...data, email: data.email || undefined, workspaceId, createdById: user.id } }); await audit(workspaceId, "create", "Lead", record.id, user.id); return record; }
export async function createOpportunity(workspaceId: string, input: unknown) { const { user } = await requireWorkspaceAccess(workspaceId); const data = opportunitySchema.parse(input); const record = await prisma.opportunity.create({ data: { ...data, amount: data.amount, workspaceId, createdById: user.id } }); await audit(workspaceId, "create", "Opportunity", record.id, user.id); return record; }
export async function listPipeline(workspaceId: string) { await requireWorkspaceAccess(workspaceId); return prisma.pipeline.findMany({ where: { workspaceId, status: "ACTIVE" }, include: { stages: { orderBy: { position: "asc" } }, opportunities: true } }); }
