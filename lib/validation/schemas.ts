import { z } from "zod";
export const workspaceSchema = z.object({ name: z.string().min(2).max(120) });
export const companySchema = z.object({ name: z.string().min(2), domain: z.string().optional(), industry: z.string().optional() });
export const contactSchema = z.object({ firstName: z.string().min(1), lastName: z.string().min(1), email: z.string().email().optional().or(z.literal("")), companyId: z.string().optional() });
export const leadSchema = z.object({ name: z.string().min(2), email: z.string().email().optional().or(z.literal("")), source: z.string().optional() });
export const opportunitySchema = z.object({ name: z.string().min(2), amount: z.coerce.number().nonnegative().optional(), companyId: z.string().optional(), contactId: z.string().optional(), leadId: z.string().optional(), stageId: z.string().optional() });
export const diagnosticSchema = z.object({ title: z.string().min(2), relatedType: z.string().optional(), relatedId: z.string().optional(), transcript: z.string().min(10).optional() });
