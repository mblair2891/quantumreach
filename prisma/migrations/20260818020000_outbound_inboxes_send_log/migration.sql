-- Instantly-style cold outreach: inboxes + send log. Independent of SES.

ALTER TABLE "SendingDomain" ADD COLUMN IF NOT EXISTS "dailyCapOverride" INTEGER;

CREATE TABLE "Inbox" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sendingDomainId" TEXT NOT NULL,
    "localPart" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "health" TEXT NOT NULL DEFAULT 'HEALTHY',
    "dailyLimit" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Inbox_sendingDomainId_localPart_key" ON "Inbox"("sendingDomainId", "localPart");
CREATE UNIQUE INDEX "Inbox_workspaceId_emailAddress_key" ON "Inbox"("workspaceId", "emailAddress");
CREATE INDEX "Inbox_workspaceId_status_idx" ON "Inbox"("workspaceId", "status");

ALTER TABLE "Inbox" ADD CONSTRAINT "Inbox_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Inbox" ADD CONSTRAINT "Inbox_sendingDomainId_fkey" FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SendLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "inboxId" TEXT NOT NULL,
    "sendingDomainId" TEXT NOT NULL,
    "contactId" TEXT,
    "toEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "blockReason" TEXT,
    "utcDay" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SendLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SendLog_inboxId_utcDay_status_idx" ON "SendLog"("inboxId", "utcDay", "status");
CREATE INDEX "SendLog_sendingDomainId_utcDay_status_idx" ON "SendLog"("sendingDomainId", "utcDay", "status");
CREATE INDEX "SendLog_workspaceId_utcDay_status_idx" ON "SendLog"("workspaceId", "utcDay", "status");

ALTER TABLE "SendLog" ADD CONSTRAINT "SendLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SendLog" ADD CONSTRAINT "SendLog_inboxId_fkey" FOREIGN KEY ("inboxId") REFERENCES "Inbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SendLog" ADD CONSTRAINT "SendLog_sendingDomainId_fkey" FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
