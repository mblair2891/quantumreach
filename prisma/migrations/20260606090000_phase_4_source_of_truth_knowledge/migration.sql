-- CreateEnum
CREATE TYPE "KnowledgeAuthorityLevel" AS ENUM ('SYSTEM_DOCTRINE', 'PRODUCT_DOCTRINE', 'UX_COPY_DOCTRINE', 'STRATEGY_FRAMEWORK', 'DIAGNOSTIC_FRAMEWORK', 'ROI_FRAMEWORK', 'REPORT_FRAMEWORK', 'ROADMAP_FRAMEWORK', 'PROPOSAL_FRAMEWORK', 'EXECUTION_HANDOFF', 'AUTHORITY_TEMPLATE', 'TRAINING_CURRICULUM', 'COURSE_TEMPLATE', 'REFERENCE');

-- CreateEnum
CREATE TYPE "KnowledgePriority" AS ENUM ('GLOBAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "KnowledgeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkflowStage" AS ENUM ('LEAD_CAPTURE', 'OUTREACH', 'DISCOVERY_CALL', 'TRANSCRIPT_ANALYSIS', 'DIAGNOSTIC_REVIEW', 'REPORT_GENERATION', 'ROADMAP_GENERATION', 'PROPOSAL_GENERATION', 'ROI_MODELING', 'IMPLEMENTATION_HANDOFF', 'AUTHORITY_ASSET_GENERATION', 'ACADEMY_TRAINING', 'APP_UX', 'OFFER_CREATION', 'POSITIONING');

-- CreateEnum
CREATE TYPE "LeadImportMethod" AS ENUM ('MANUAL', 'CSV', 'CRM_IMPORT', 'APPROVED_DATA_PROVIDER', 'OTHER');

-- CreateEnum
CREATE TYPE "OutreachPermissionStatus" AS ENUM ('UNKNOWN', 'PERMITTED', 'DO_NOT_CONTACT', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('NOT_STARTED', 'QUEUED', 'SENT', 'OPENED', 'REPLIED', 'CALL_BOOKED', 'CALL_COMPLETED', 'TRANSCRIPT_READY', 'ANALYZED');

-- CreateEnum
CREATE TYPE "CallProvider" AS ENUM ('ZOOM', 'GOOGLE_MEET', 'TEAMS', 'OTHER');

-- CreateEnum
CREATE TYPE "CallSessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'TRANSCRIPT_READY', 'DIAGNOSTIC_CREATED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "campaignName" TEXT,
ADD COLUMN     "importMethod" "LeadImportMethod" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "outreachPermissionStatus" "OutreachPermissionStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "sourceNotes" TEXT,
ADD COLUMN     "sourcePlatform" TEXT,
ADD COLUMN     "sourceUrl" TEXT;

-- AlterTable
ALTER TABLE "DiagnosticSession" ADD COLUMN     "callSessionId" TEXT;

-- CreateTable
CREATE TABLE "KnowledgeCollection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "collectionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "documentType" "KnowledgeAuthorityLevel" NOT NULL,
    "authorityLevel" "KnowledgeAuthorityLevel" NOT NULL,
    "priority" "KnowledgePriority" NOT NULL DEFAULT 'MEDIUM',
    "workflowStages" JSONB NOT NULL DEFAULT '[]',
    "offerLine" TEXT,
    "audience" TEXT,
    "industry" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'DRAFT',
    "version" TEXT NOT NULL DEFAULT '1.0',
    "sourceFileName" TEXT,
    "sourceMimeType" TEXT,
    "sourceText" TEXT NOT NULL,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "heading" TEXT,
    "text" TEXT NOT NULL,
    "characterCount" INTEGER NOT NULL,
    "workflowStages" JSONB NOT NULL DEFAULT '[]',
    "documentType" "KnowledgeAuthorityLevel" NOT NULL,
    "authorityLevel" "KnowledgeAuthorityLevel" NOT NULL,
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocumentUsage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "workflowStage" "WorkflowStage" NOT NULL,
    "usedFor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeDocumentUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeSourceReference" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkId" TEXT,
    "label" TEXT NOT NULL,
    "url" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeSourceReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachCampaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachStep" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadOutreachStatus" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "campaignId" TEXT,
    "status" "OutreachStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadOutreachStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSession" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT,
    "contactId" TEXT,
    "companyId" TEXT,
    "opportunityId" TEXT,
    "provider" "CallProvider" NOT NULL DEFAULT 'OTHER',
    "meetingUrl" TEXT,
    "recordingUrl" TEXT,
    "transcriptText" TEXT,
    "transcriptSource" TEXT,
    "callDate" TIMESTAMP(3),
    "status" "CallSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeCollection_workspaceId_status_idx" ON "KnowledgeCollection"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_workspaceId_status_idx" ON "KnowledgeDocument"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_workspaceId_authorityLevel_priority_idx" ON "KnowledgeDocument"("workspaceId", "authorityLevel", "priority");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_workspaceId_documentType_idx" ON "KnowledgeDocument"("workspaceId", "documentType");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_workspaceId_status_idx" ON "KnowledgeChunk"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_workspaceId_authorityLevel_idx" ON "KnowledgeChunk"("workspaceId", "authorityLevel");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_documentId_chunkIndex_key" ON "KnowledgeChunk"("documentId", "chunkIndex");

-- CreateIndex
CREATE INDEX "KnowledgeDocumentUsage_workspaceId_entityType_entityId_idx" ON "KnowledgeDocumentUsage"("workspaceId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "KnowledgeDocumentUsage_workspaceId_workflowStage_idx" ON "KnowledgeDocumentUsage"("workspaceId", "workflowStage");

-- CreateIndex
CREATE INDEX "KnowledgeDocumentUsage_documentId_idx" ON "KnowledgeDocumentUsage"("documentId");

-- CreateIndex
CREATE INDEX "KnowledgeDocumentUsage_chunkId_idx" ON "KnowledgeDocumentUsage"("chunkId");

-- CreateIndex
CREATE INDEX "KnowledgeSourceReference_workspaceId_documentId_idx" ON "KnowledgeSourceReference"("workspaceId", "documentId");

-- CreateIndex
CREATE INDEX "OutreachCampaign_workspaceId_status_idx" ON "OutreachCampaign"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "OutreachStep_workspaceId_campaignId_idx" ON "OutreachStep"("workspaceId", "campaignId");

-- CreateIndex
CREATE INDEX "LeadOutreachStatus_workspaceId_status_idx" ON "LeadOutreachStatus"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LeadOutreachStatus_workspaceId_leadId_campaignId_key" ON "LeadOutreachStatus"("workspaceId", "leadId", "campaignId");

-- CreateIndex
CREATE INDEX "CallSession_workspaceId_status_idx" ON "CallSession"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "CallSession_workspaceId_leadId_idx" ON "CallSession"("workspaceId", "leadId");

-- CreateIndex
CREATE INDEX "CallSession_workspaceId_opportunityId_idx" ON "CallSession"("workspaceId", "opportunityId");

-- CreateIndex
CREATE INDEX "DiagnosticSession_callSessionId_idx" ON "DiagnosticSession"("callSessionId");

-- AddForeignKey
ALTER TABLE "DiagnosticSession" ADD CONSTRAINT "DiagnosticSession_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "CallSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeCollection" ADD CONSTRAINT "KnowledgeCollection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "KnowledgeCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocumentUsage" ADD CONSTRAINT "KnowledgeDocumentUsage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocumentUsage" ADD CONSTRAINT "KnowledgeDocumentUsage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocumentUsage" ADD CONSTRAINT "KnowledgeDocumentUsage_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "KnowledgeChunk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSourceReference" ADD CONSTRAINT "KnowledgeSourceReference_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSourceReference" ADD CONSTRAINT "KnowledgeSourceReference_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSourceReference" ADD CONSTRAINT "KnowledgeSourceReference_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "KnowledgeChunk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachCampaign" ADD CONSTRAINT "OutreachCampaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachStep" ADD CONSTRAINT "OutreachStep_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachStep" ADD CONSTRAINT "OutreachStep_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "OutreachCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadOutreachStatus" ADD CONSTRAINT "LeadOutreachStatus_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadOutreachStatus" ADD CONSTRAINT "LeadOutreachStatus_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadOutreachStatus" ADD CONSTRAINT "LeadOutreachStatus_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "OutreachCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

