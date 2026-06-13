import { z } from "zod";
import { DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES, KNOWLEDGE_UPLOAD_SUPPORTED_EXTENSIONS } from "@/lib/knowledge/import";

const optionalText = z.string().trim().optional().or(z.literal(""));
const optionalId = z.string().trim().optional().or(z.literal(""));

export const workspaceSchema = z.object({ name: z.string().min(2).max(120) });

export const companySchema = z.object({
  name: z.string().trim().min(2, "Company name is required"),
  domain: optionalText,
  industry: optionalText,
  employeeCount: z.coerce.number().int().nonnegative().optional().or(z.literal("")),
  annualRevenue: z.coerce.number().nonnegative().optional().or(z.literal(""))
});

export const contactSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: optionalText,
  title: optionalText,
  companyId: optionalId
});

export const leadSchema = z.object({
  name: z.string().trim().min(2, "Lead name is required"),
  email: z.string().email().optional().or(z.literal("")),
  source: optionalText,
  sourcePlatform: optionalText,
  sourceUrl: optionalText,
  importMethod: z.enum(["MANUAL", "CSV", "CRM_IMPORT", "APPROVED_DATA_PROVIDER", "OTHER"]).default("MANUAL"),
  campaignName: optionalText,
  sourceNotes: optionalText,
  outreachPermissionStatus: z.enum(["UNKNOWN", "PERMITTED", "DO_NOT_CONTACT", "NEEDS_REVIEW"]).default("UNKNOWN"),
  companyId: optionalId,
  contactId: optionalId,
  score: z.coerce.number().int().min(0).max(100).optional().or(z.literal(""))
});

export const opportunitySchema = z.object({
  name: z.string().trim().min(2, "Opportunity name is required"),
  amount: z.coerce.number().nonnegative().optional().or(z.literal("")),
  closeDate: z.string().optional().or(z.literal("")),
  companyId: optionalId,
  contactId: optionalId,
  leadId: optionalId,
  pipelineId: optionalId,
  stageId: optionalId
});

export const diagnosticSchema = z.object({ title: z.string().min(2), relatedType: z.string().optional(), relatedId: z.string().optional(), transcript: z.string().min(10).optional() });

export const activityNoteSchema = z.object({ body: z.string().trim().min(2, "Note text is required") });
export const activityTaskSchema = z.object({ title: z.string().trim().min(2, "Task title is required"), description: optionalText, dueAt: z.string().optional().or(z.literal("")), priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM") });
export const followUpSchema = z.object({ title: z.string().trim().min(2, "Follow-up title is required"), dueAt: z.string().optional().or(z.literal("")) });
export const transcriptContextSchema = z.object({ transcript: z.string().trim().optional().or(z.literal("")), discoveryNotes: z.string().trim().optional().or(z.literal("")), businessContext: z.string().trim().optional().or(z.literal("")) }).refine((data) => Boolean(data.transcript || data.discoveryNotes || data.businessContext), "At least one transcript or context field is required");

export const outreachCampaignSchema = z.object({ name: z.string().trim().min(2), description: optionalText });
export const outreachLeadAssignmentSchema = z.object({ leadId: z.string().trim().min(1), notes: optionalText });
export const outreachStatusSchema = z.object({ campaignId: optionalId, status: z.enum(["NOT_STARTED", "QUEUED", "SENT", "OPENED", "REPLIED", "CALL_BOOKED", "CALL_COMPLETED", "TRANSCRIPT_READY", "ANALYZED"]), notes: optionalText });
export const callSessionStatusSchema = z.enum(["SCHEDULED", "COMPLETED", "TRANSCRIPT_READY", "DIAGNOSTIC_CREATED", "ANALYZED", "ARCHIVED"]);
export const callTranscriptSchema = z.object({ transcriptText: optionalText, transcriptSource: optionalText });
export const callSessionSchema = z.object({ leadId: optionalId, contactId: optionalId, companyId: optionalId, opportunityId: optionalId, provider: z.enum(["ZOOM", "GOOGLE_MEET", "TEAMS", "OTHER"]).default("OTHER"), meetingUrl: optionalText, recordingUrl: optionalText, transcriptText: optionalText, transcriptSource: optionalText, callDate: z.string().optional().or(z.literal("")), status: callSessionStatusSchema.default("SCHEDULED") });


export const knowledgeBulkImportPayloadSchema = z.object({
  documents: z.array(z.object({
    title: z.string().trim().min(2),
    description: optionalText,
    documentType: z.enum(["SYSTEM_DOCTRINE", "PRODUCT_DOCTRINE", "UX_COPY_DOCTRINE", "STRATEGY_FRAMEWORK", "DIAGNOSTIC_FRAMEWORK", "ROI_FRAMEWORK", "REPORT_FRAMEWORK", "ROADMAP_FRAMEWORK", "PROPOSAL_FRAMEWORK", "EXECUTION_HANDOFF", "AUTHORITY_TEMPLATE", "TRAINING_CURRICULUM", "COURSE_TEMPLATE", "REFERENCE"]),
    authorityLevel: z.enum(["SYSTEM_DOCTRINE", "PRODUCT_DOCTRINE", "UX_COPY_DOCTRINE", "STRATEGY_FRAMEWORK", "DIAGNOSTIC_FRAMEWORK", "ROI_FRAMEWORK", "REPORT_FRAMEWORK", "ROADMAP_FRAMEWORK", "PROPOSAL_FRAMEWORK", "EXECUTION_HANDOFF", "AUTHORITY_TEMPLATE", "TRAINING_CURRICULUM", "COURSE_TEMPLATE", "REFERENCE"]),
    priority: z.enum(["GLOBAL", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
    workflowStages: z.array(z.enum(["LEAD_CAPTURE", "OUTREACH", "DISCOVERY_CALL", "TRANSCRIPT_ANALYSIS", "DIAGNOSTIC_REVIEW", "REPORT_GENERATION", "ROADMAP_GENERATION", "PROPOSAL_GENERATION", "ROI_MODELING", "IMPLEMENTATION_HANDOFF", "AUTHORITY_ASSET_GENERATION", "ACADEMY_TRAINING", "APP_UX", "OFFER_CREATION", "POSITIONING"])).default([]),
    version: z.string().trim().default("1.0"),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
    sourceFileName: z.string().trim().min(1),
    clientId: optionalText,
    sourceMimeType: optionalText,
    sourceFileSizeBytes: z.coerce.number().int().nonnegative().optional(),
    storageKey: optionalText,
    supersedesDocumentId: optionalText,
    sourceText: z.string().trim().min(10)
  }).superRefine((document, context) => {
    const lowerName = document.sourceFileName.toLowerCase();
    if (!KNOWLEDGE_UPLOAD_SUPPORTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) context.addIssue({ code: z.ZodIssueCode.custom, message: "Unsupported knowledge source file type.", path: ["sourceFileName"] });
    if (document.sourceFileSizeBytes !== undefined && document.sourceFileSizeBytes > DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES) context.addIssue({ code: z.ZodIssueCode.custom, message: "Knowledge source file exceeds the upload size limit.", path: ["sourceFileSizeBytes"] });
  })).min(1).max(12)
});
