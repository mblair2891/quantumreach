-- CreateEnum
CREATE TYPE "ManagedDomainOwnershipType" AS ENUM ('QUANTUM_REACH_MANAGED', 'WORKSPACE_OWNED', 'SHARED_POOL');

-- CreateEnum
CREATE TYPE "ManagedDomainLifecycleStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'PURCHASING', 'PURCHASED', 'DNS_CONFIGURING', 'DNS_PENDING', 'SES_PENDING', 'WARMING', 'ACTIVE', 'PAUSED', 'RETIRED', 'BURNED', 'FAILED');

-- CreateEnum
CREATE TYPE "ManagedDomainAssignmentType" AS ENUM ('LEASED', 'SOLD', 'INTERNAL', 'BROUGHT_BY_WORKSPACE');

-- CreateEnum
CREATE TYPE "ManagedDomainAssignmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'RELEASED', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "ManagedDomainBillingStatus" AS ENUM ('NOT_BILLED', 'BILLING_PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "DomainPurchaseRequestStatus" AS ENUM ('DRAFT', 'QUOTED', 'APPROVED', 'PURCHASING', 'PURCHASED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "DomainDnsRecordPurpose" AS ENUM ('SPF', 'DKIM', 'DMARC', 'SES_VERIFICATION', 'MAIL_FROM', 'TRACKING', 'OTHER');

-- CreateEnum
CREATE TYPE "DomainDnsRecordStatus" AS ENUM ('REQUIRED', 'PENDING', 'APPLIED', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "DomainWarmupStatus" AS ENUM ('NOT_STARTED', 'SCHEDULED', 'WARMING', 'PAUSED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DomainWarmupEventType" AS ENUM ('CREATED', 'STARTED', 'LIMIT_INCREASED', 'PAUSED', 'RESUMED', 'COMPLETED', 'FAILED', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "DomainHealthStatus" AS ENUM ('UNKNOWN', 'GOOD', 'WATCH', 'DEGRADED', 'CRITICAL');

-- CreateTable
CREATE TABLE "ManagedDomain" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "domainName" TEXT NOT NULL,
    "rootDomain" TEXT NOT NULL,
    "tld" TEXT NOT NULL,
    "ownershipType" "ManagedDomainOwnershipType" NOT NULL,
    "lifecycleStatus" "ManagedDomainLifecycleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "provider" TEXT,
    "providerDomainId" TEXT,
    "registrarStatus" TEXT,
    "expirationDate" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "purchaseCostCents" INTEGER,
    "resalePriceCents" INTEGER,
    "renewalCostCents" INTEGER,
    "markupPercent" INTEGER,
    "assignedAt" TIMESTAMP(3),
    "assignedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedDomainAssignment" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "assignedByUserId" TEXT,
    "assignmentType" "ManagedDomainAssignmentType" NOT NULL,
    "status" "ManagedDomainAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "billingStatus" "ManagedDomainBillingStatus" NOT NULL DEFAULT 'NOT_BILLED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedDomainAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainPurchaseRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "domainId" TEXT,
    "requestedDomain" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "status" "DomainPurchaseRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "estimatedCostCents" INTEGER,
    "resalePriceCents" INTEGER,
    "providerQuoteId" TEXT,
    "safeError" TEXT,
    "approvedByUserId" TEXT,
    "purchasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainPurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainDnsRecord" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "priority" INTEGER,
    "ttl" INTEGER,
    "purpose" "DomainDnsRecordPurpose" NOT NULL,
    "status" "DomainDnsRecordStatus" NOT NULL DEFAULT 'REQUIRED',
    "providerRecordId" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "safeError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainDnsRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainSesIdentity" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "sesRegion" TEXT NOT NULL,
    "identityArn" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "dkimStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "mailFromStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "configurationSet" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "safeError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainSesIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainWarmupPlan" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "status" "DomainWarmupStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startDate" TIMESTAMP(3),
    "currentDay" INTEGER NOT NULL DEFAULT 0,
    "rampDays" INTEGER NOT NULL DEFAULT 30,
    "startingDailyLimit" INTEGER NOT NULL DEFAULT 10,
    "currentDailyLimit" INTEGER NOT NULL DEFAULT 10,
    "targetDailyLimit" INTEGER NOT NULL DEFAULT 500,
    "maxDailyLimit" INTEGER NOT NULL DEFAULT 500,
    "lastAdvancedAt" TIMESTAMP(3),
    "safeError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainWarmupPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainWarmupEvent" (
    "id" TEXT NOT NULL,
    "warmupPlanId" TEXT NOT NULL,
    "eventType" "DomainWarmupEventType" NOT NULL,
    "oldLimit" INTEGER,
    "newLimit" INTEGER,
    "message" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainWarmupEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainReputationSnapshot" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "bounceCount" INTEGER NOT NULL DEFAULT 0,
    "complaintCount" INTEGER NOT NULL DEFAULT 0,
    "unsubscribeCount" INTEGER NOT NULL DEFAULT 0,
    "blockCount" INTEGER NOT NULL DEFAULT 0,
    "openRate" DOUBLE PRECISION,
    "clickRate" DOUBLE PRECISION,
    "bounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "complaintRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "healthStatus" "DomainHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainReputationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainAuditEvent" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "actorUserId" TEXT,
    "eventType" TEXT NOT NULL,
    "safeSummary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagedDomain_domainName_key" ON "ManagedDomain"("domainName");

-- CreateIndex
CREATE INDEX "ManagedDomain_workspaceId_lifecycleStatus_idx" ON "ManagedDomain"("workspaceId", "lifecycleStatus");

-- CreateIndex
CREATE INDEX "ManagedDomain_ownershipType_lifecycleStatus_idx" ON "ManagedDomain"("ownershipType", "lifecycleStatus");

-- CreateIndex
CREATE INDEX "ManagedDomainAssignment_workspaceId_status_idx" ON "ManagedDomainAssignment"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedDomainAssignment_domainId_workspaceId_status_key" ON "ManagedDomainAssignment"("domainId", "workspaceId", "status");

-- CreateIndex
CREATE INDEX "DomainPurchaseRequest_workspaceId_status_idx" ON "DomainPurchaseRequest"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "DomainDnsRecord_domainId_purpose_status_idx" ON "DomainDnsRecord"("domainId", "purpose", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DomainSesIdentity_domainId_key" ON "DomainSesIdentity"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "DomainWarmupPlan_domainId_key" ON "DomainWarmupPlan"("domainId");

-- CreateIndex
CREATE INDEX "DomainWarmupPlan_status_idx" ON "DomainWarmupPlan"("status");

-- CreateIndex
CREATE INDEX "DomainWarmupEvent_warmupPlanId_eventType_idx" ON "DomainWarmupEvent"("warmupPlanId", "eventType");

-- CreateIndex
CREATE INDEX "DomainReputationSnapshot_healthStatus_idx" ON "DomainReputationSnapshot"("healthStatus");

-- CreateIndex
CREATE UNIQUE INDEX "DomainReputationSnapshot_domainId_date_key" ON "DomainReputationSnapshot"("domainId", "date");

-- CreateIndex
CREATE INDEX "DomainAuditEvent_domainId_eventType_idx" ON "DomainAuditEvent"("domainId", "eventType");

-- CreateIndex
CREATE INDEX "DomainAuditEvent_workspaceId_createdAt_idx" ON "DomainAuditEvent"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "ManagedDomain" ADD CONSTRAINT "ManagedDomain_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedDomain" ADD CONSTRAINT "ManagedDomain_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedDomainAssignment" ADD CONSTRAINT "ManagedDomainAssignment_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ManagedDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedDomainAssignment" ADD CONSTRAINT "ManagedDomainAssignment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedDomainAssignment" ADD CONSTRAINT "ManagedDomainAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainPurchaseRequest" ADD CONSTRAINT "DomainPurchaseRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainPurchaseRequest" ADD CONSTRAINT "DomainPurchaseRequest_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ManagedDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainPurchaseRequest" ADD CONSTRAINT "DomainPurchaseRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainPurchaseRequest" ADD CONSTRAINT "DomainPurchaseRequest_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainDnsRecord" ADD CONSTRAINT "DomainDnsRecord_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ManagedDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainSesIdentity" ADD CONSTRAINT "DomainSesIdentity_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ManagedDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainWarmupPlan" ADD CONSTRAINT "DomainWarmupPlan_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ManagedDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainWarmupEvent" ADD CONSTRAINT "DomainWarmupEvent_warmupPlanId_fkey" FOREIGN KEY ("warmupPlanId") REFERENCES "DomainWarmupPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainWarmupEvent" ADD CONSTRAINT "DomainWarmupEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainReputationSnapshot" ADD CONSTRAINT "DomainReputationSnapshot_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ManagedDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainAuditEvent" ADD CONSTRAINT "DomainAuditEvent_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ManagedDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainAuditEvent" ADD CONSTRAINT "DomainAuditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainAuditEvent" ADD CONSTRAINT "DomainAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
