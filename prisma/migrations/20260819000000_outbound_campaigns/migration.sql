-- Phase 2 Instantly-style campaigns: lists, jobs, rotation metadata. Not SES.

ALTER TABLE "Inbox" ADD COLUMN IF NOT EXISTS "lastSentAt" TIMESTAMP(3);
ALTER TABLE "SendLog" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;
ALTER TABLE "SendLog" ADD COLUMN IF NOT EXISTS "campaignJobId" TEXT;
CREATE INDEX IF NOT EXISTS "SendLog_campaignId_idx" ON "SendLog"("campaignId");

CREATE TABLE "OutboundList" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundList_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutboundList_workspaceId_createdAt_idx" ON "OutboundList"("workspaceId", "createdAt");
ALTER TABLE "OutboundList" ADD CONSTRAINT "OutboundList_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OutboundListMember" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundListMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutboundListMember_listId_contactId_key" ON "OutboundListMember"("listId", "contactId");
CREATE INDEX "OutboundListMember_contactId_idx" ON "OutboundListMember"("contactId");
ALTER TABLE "OutboundListMember" ADD CONSTRAINT "OutboundListMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "OutboundList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutboundListMember" ADD CONSTRAINT "OutboundListMember_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OutboundCampaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "inboxPool" JSONB NOT NULL DEFAULT '{"type":"all"}',
    "fromName" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "startAt" TIMESTAMP(3),
    "pauseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutboundCampaign_workspaceId_status_idx" ON "OutboundCampaign"("workspaceId", "status");
ALTER TABLE "OutboundCampaign" ADD CONSTRAINT "OutboundCampaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutboundCampaign" ADD CONSTRAINT "OutboundCampaign_listId_fkey" FOREIGN KEY ("listId") REFERENCES "OutboundList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OutboundCampaignJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "inboxId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "skipReason" TEXT,
    "sendLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundCampaignJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutboundCampaignJob_campaignId_contactId_key" ON "OutboundCampaignJob"("campaignId", "contactId");
CREATE INDEX "OutboundCampaignJob_campaignId_status_nextAttemptAt_idx" ON "OutboundCampaignJob"("campaignId", "status", "nextAttemptAt");
CREATE INDEX "OutboundCampaignJob_workspaceId_status_idx" ON "OutboundCampaignJob"("workspaceId", "status");
ALTER TABLE "OutboundCampaignJob" ADD CONSTRAINT "OutboundCampaignJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutboundCampaignJob" ADD CONSTRAINT "OutboundCampaignJob_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "OutboundCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutboundCampaignJob" ADD CONSTRAINT "OutboundCampaignJob_inboxId_fkey" FOREIGN KEY ("inboxId") REFERENCES "Inbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
