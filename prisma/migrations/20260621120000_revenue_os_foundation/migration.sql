-- CreateEnum
CREATE TYPE "RevenueDealStatus" AS ENUM ('NEW', 'CONTACTED', 'INTERESTED', 'DISCOVERY_SCHEDULED', 'DISCOVERY_COMPLETE', 'PROPOSAL_GENERATED', 'PROPOSAL_PRESENTED', 'CONTRACT_SENT', 'WON', 'LOST', 'NURTURE');

-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('IMPORTED_CSV', 'MANUAL', 'FORM_SCHEDULER', 'CAMPAIGN_REPLY', 'CLIENT_PROVISIONED');

-- CreateEnum
CREATE TYPE "ContactImportStatus" AS ENUM ('PREVIEW', 'COMMITTED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "EmailSuppressionReason" AS ENUM ('UNSUBSCRIBED', 'HARD_BOUNCE', 'COMPLAINT', 'MANUAL', 'IMPORTED');

-- CreateEnum
CREATE TYPE "SendingDomainStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'DISABLED');

-- CreateEnum
CREATE TYPE "SenderIdentityStatus" AS ENUM ('DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "EmailCampaignStatus" AS ENUM ('DRAFT', 'COMPLIANCE_REVIEW', 'READY', 'SCHEDULED', 'SENDING', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EmailComplianceStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EmailSendStatus" AS ENUM ('QUEUED', 'BLOCKED_COMPLIANCE', 'BLOCKED_SUPPRESSED', 'BLOCKED_LIMIT', 'SENT', 'FAILED', 'BOUNCED', 'COMPLAINED', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "SchedulingPageStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('SCHEDULED', 'RESCHEDULED', 'CANCELED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ResearchRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ResearchTargetType" AS ENUM ('CONTACT', 'COMPANY', 'DEAL', 'MEETING');

-- CreateEnum
CREATE TYPE "ProposalWorkflowStatus" AS ENUM ('DRAFT', 'READY', 'PRESENTED', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ContractWorkflowStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'SIGNED', 'DECLINED', 'VOIDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ContractSignatureMethod" AS ENUM ('TYPED', 'DRAWN');

-- CreateEnum
CREATE TYPE "WorkspaceSubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'UNPAID', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "ProvisioningRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'PROVISIONED', 'FAILED', 'CANCELED');

-- CreateTable
CREATE TABLE "ContactImportBatch" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fileName" TEXT,
    "status" "ContactImportStatus" NOT NULL DEFAULT 'PREVIEW',
    "complianceAttested" BOOLEAN NOT NULL DEFAULT false,
    "attestationText" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "validCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactImportRow" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "raw" JSONB NOT NULL DEFAULT '{}',
    "mapped" JSONB NOT NULL DEFAULT '{}',
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "issues" JSONB NOT NULL DEFAULT '[]',
    "dedupeKey" TEXT,
    "committedContactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuppressionListEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" "EmailSuppressionReason" NOT NULL,
    "source" TEXT,
    "contactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuppressionListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SendingDomain" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" "SendingDomainStatus" NOT NULL DEFAULT 'PENDING',
    "dnsRecords" JSONB NOT NULL DEFAULT '[]',
    "reputationStatus" TEXT NOT NULL DEFAULT 'not_started',
    "dailyLimit" INTEGER NOT NULL DEFAULT 50,
    "warmupStatus" TEXT NOT NULL DEFAULT 'not_started',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SendingDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SenderIdentity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "domainId" TEXT,
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "replyToEmail" TEXT,
    "status" "SenderIdentityStatus" NOT NULL DEFAULT 'DRAFT',
    "dailyLimit" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SenderIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "senderIdentityId" TEXT,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "campaignType" TEXT NOT NULL DEFAULT 'cold_outreach',
    "targetSegment" TEXT,
    "physicalMailingAddress" TEXT,
    "status" "EmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "complianceStatus" "EmailComplianceStatus" NOT NULL DEFAULT 'DRAFT',
    "complianceChecklist" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSequenceStep" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "delayHours" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailRecipient" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT,
    "email" TEXT NOT NULL,
    "status" "EmailSendStatus" NOT NULL DEFAULT 'QUEUED',
    "unsubscribeToken" TEXT NOT NULL,
    "schedulingToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSend" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT,
    "sequenceStepId" TEXT,
    "contactId" TEXT,
    "senderIdentityId" TEXT,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHash" TEXT,
    "status" "EmailSendStatus" NOT NULL DEFAULT 'QUEUED',
    "blockReason" TEXT,
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "emailSendId" TEXT,
    "eventType" TEXT NOT NULL,
    "safeSummary" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulingPage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "meetingType" TEXT NOT NULL DEFAULT 'Discovery',
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "availability" JSONB NOT NULL DEFAULT '[]',
    "bufferMinutes" INTEGER NOT NULL DEFAULT 15,
    "status" "SchedulingPageStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulingPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "schedulingPageId" TEXT NOT NULL,
    "contactId" TEXT,
    "companyId" TEXT,
    "opportunityId" TEXT,
    "campaignId" TEXT,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companyName" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "zoomJoinUrl" TEXT,
    "zoomMeetingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingQuestion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "schedulingPageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BookingQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingResponse" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "questionId" TEXT,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "BookingResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "targetType" "ResearchTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" "ResearchRunStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT,
    "summary" TEXT,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "insights" JSONB NOT NULL DEFAULT '[]',
    "safeError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewQuestionSet" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "researchRunId" TEXT,
    "targetType" "ResearchTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "reviewRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewQuestionSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "counselReviewRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractSigner" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "token" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractSigner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractSignature" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "signerId" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerEmail" TEXT NOT NULL,
    "method" "ContractSignatureMethod" NOT NULL DEFAULT 'TYPED',
    "consentedAt" TIMESTAMP(3) NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "ContractSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractAuditEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "signerId" TEXT,
    "eventType" TEXT NOT NULL,
    "safeMetadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractDocumentArtifact" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "storageKey" TEXT,
    "htmlSnapshot" TEXT,
    "sha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractDocumentArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceSubscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "status" "WorkspaceSubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "planKey" TEXT,
    "entitlements" JSONB NOT NULL DEFAULT '{}',
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientWorkspaceProvisioningRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT,
    "companyId" TEXT,
    "contractId" TEXT,
    "requestedWorkspaceName" TEXT NOT NULL,
    "status" "ProvisioningRequestStatus" NOT NULL DEFAULT 'PENDING',
    "provisionedWorkspaceId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientWorkspaceProvisioningRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactImportBatch_workspaceId_status_idx" ON "ContactImportBatch"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ContactImportRow_workspaceId_batchId_idx" ON "ContactImportRow"("workspaceId", "batchId");

-- CreateIndex
CREATE INDEX "ContactImportRow_workspaceId_dedupeKey_idx" ON "ContactImportRow"("workspaceId", "dedupeKey");

-- CreateIndex
CREATE INDEX "SuppressionListEntry_workspaceId_email_idx" ON "SuppressionListEntry"("workspaceId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "SuppressionListEntry_workspaceId_email_reason_key" ON "SuppressionListEntry"("workspaceId", "email", "reason");

-- CreateIndex
CREATE INDEX "SendingDomain_workspaceId_status_idx" ON "SendingDomain"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SendingDomain_workspaceId_domain_key" ON "SendingDomain"("workspaceId", "domain");

-- CreateIndex
CREATE INDEX "SenderIdentity_workspaceId_status_idx" ON "SenderIdentity"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "EmailCampaign_workspaceId_status_idx" ON "EmailCampaign"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSequenceStep_campaignId_stepNumber_key" ON "EmailSequenceStep"("campaignId", "stepNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EmailRecipient_unsubscribeToken_key" ON "EmailRecipient"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "EmailRecipient_workspaceId_email_idx" ON "EmailRecipient"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "EmailSend_workspaceId_status_idx" ON "EmailSend"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "EmailSend_workspaceId_email_idx" ON "EmailSend"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "EmailEvent_workspaceId_eventType_idx" ON "EmailEvent"("workspaceId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulingPage_slug_key" ON "SchedulingPage"("slug");

-- CreateIndex
CREATE INDEX "SchedulingPage_workspaceId_status_idx" ON "SchedulingPage"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_token_key" ON "Booking"("token");

-- CreateIndex
CREATE INDEX "Booking_workspaceId_startsAt_idx" ON "Booking"("workspaceId", "startsAt");

-- CreateIndex
CREATE INDEX "ResearchRun_workspaceId_targetType_targetId_idx" ON "ResearchRun"("workspaceId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "InterviewQuestionSet_workspaceId_targetType_targetId_idx" ON "InterviewQuestionSet"("workspaceId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "ContractTemplate_workspaceId_status_idx" ON "ContractTemplate"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ContractSigner_token_key" ON "ContractSigner"("token");

-- CreateIndex
CREATE INDEX "ContractSigner_workspaceId_contractId_idx" ON "ContractSigner"("workspaceId", "contractId");

-- CreateIndex
CREATE INDEX "ContractAuditEvent_workspaceId_contractId_idx" ON "ContractAuditEvent"("workspaceId", "contractId");

-- CreateIndex
CREATE INDEX "ContractDocumentArtifact_workspaceId_contractId_idx" ON "ContractDocumentArtifact"("workspaceId", "contractId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceSubscription_workspaceId_key" ON "WorkspaceSubscription"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceSubscription_status_idx" ON "WorkspaceSubscription"("status");

-- CreateIndex
CREATE INDEX "ClientWorkspaceProvisioningRequest_workspaceId_status_idx" ON "ClientWorkspaceProvisioningRequest"("workspaceId", "status");

-- AddForeignKey
ALTER TABLE "ContactImportBatch" ADD CONSTRAINT "ContactImportBatch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactImportRow" ADD CONSTRAINT "ContactImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ContactImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactImportRow" ADD CONSTRAINT "ContactImportRow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuppressionListEntry" ADD CONSTRAINT "SuppressionListEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SendingDomain" ADD CONSTRAINT "SendingDomain_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SenderIdentity" ADD CONSTRAINT "SenderIdentity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SenderIdentity" ADD CONSTRAINT "SenderIdentity_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "SendingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_senderIdentityId_fkey" FOREIGN KEY ("senderIdentityId") REFERENCES "SenderIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSequenceStep" ADD CONSTRAINT "EmailSequenceStep_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSequenceStep" ADD CONSTRAINT "EmailSequenceStep_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailRecipient" ADD CONSTRAINT "EmailRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailRecipient" ADD CONSTRAINT "EmailRecipient_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_sequenceStepId_fkey" FOREIGN KEY ("sequenceStepId") REFERENCES "EmailSequenceStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_emailSendId_fkey" FOREIGN KEY ("emailSendId") REFERENCES "EmailSend"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingPage" ADD CONSTRAINT "SchedulingPage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_schedulingPageId_fkey" FOREIGN KEY ("schedulingPageId") REFERENCES "SchedulingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingQuestion" ADD CONSTRAINT "BookingQuestion_schedulingPageId_fkey" FOREIGN KEY ("schedulingPageId") REFERENCES "SchedulingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingQuestion" ADD CONSTRAINT "BookingQuestion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingResponse" ADD CONSTRAINT "BookingResponse_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingResponse" ADD CONSTRAINT "BookingResponse_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchRun" ADD CONSTRAINT "ResearchRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewQuestionSet" ADD CONSTRAINT "InterviewQuestionSet_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewQuestionSet" ADD CONSTRAINT "InterviewQuestionSet_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractTemplate" ADD CONSTRAINT "ContractTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractSigner" ADD CONSTRAINT "ContractSigner_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractSignature" ADD CONSTRAINT "ContractSignature_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractSignature" ADD CONSTRAINT "ContractSignature_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "ContractSigner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAuditEvent" ADD CONSTRAINT "ContractAuditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAuditEvent" ADD CONSTRAINT "ContractAuditEvent_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "ContractSigner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDocumentArtifact" ADD CONSTRAINT "ContractDocumentArtifact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceSubscription" ADD CONSTRAINT "WorkspaceSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientWorkspaceProvisioningRequest" ADD CONSTRAINT "ClientWorkspaceProvisioningRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

