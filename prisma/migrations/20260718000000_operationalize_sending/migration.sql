-- Recovery migration for the missing managed email/domain infrastructure foundation.
--
-- Production history: 20260718120000_managed_email_domain_infrastructure was
-- recorded as applied with comment-only SQL, so it created no schema objects.
-- 20260718000000_operationalize_sending then failed before applying any step
-- because ManagedMailboxStatus did not exist. See
-- docs/production-migration-recovery-20260718.md before deploying this file.
--
-- Strategy A: after `prisma migrate resolve --rolled-back
-- 20260718000000_operationalize_sending`, Prisma can execute this corrected
-- migration. It is intentionally additive and guarded for the zero-step
-- failed-production state; it does not drop, rewrite, or delete data.

-- CreateEnum (guarded for recovery deployments)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommerceProductCategory') THEN
    CREATE TYPE "CommerceProductCategory" AS ENUM ('SOFTWARE_CORE', 'SOFTWARE_UPGRADE', 'SENDING_PACKAGE', 'DOMAIN_ADDON', 'SENDER_ADDON', 'SEND_CAPACITY_ADDON', 'SETUP_FEE');
  END IF;
END
$$;

-- CreateEnum (guarded for recovery deployments)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommerceBillingInterval') THEN
    CREATE TYPE "CommerceBillingInterval" AS ENUM ('MONTH', 'YEAR', 'ONE_TIME');
  END IF;
END
$$;

-- CreateEnum (guarded for recovery deployments)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProviderReadinessState') THEN
    CREATE TYPE "ProviderReadinessState" AS ENUM ('NOT_CONFIGURED', 'CONFIGURED', 'DEGRADED', 'READY', 'ERROR');
  END IF;
END
$$;

-- CreateEnum (guarded for recovery deployments)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ManagedMailboxProviderKey') THEN
    CREATE TYPE "ManagedMailboxProviderKey" AS ENUM ('DISABLED', 'OPENSRS_EMAIL', 'GENERIC_IMAP_SMTP', 'FUTURE_PROVIDER');
  END IF;
END
$$;

-- CreateEnum (guarded for recovery deployments)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ManagedMailboxStatus') THEN
    CREATE TYPE "ManagedMailboxStatus" AS ENUM ('PENDING', 'PENDING_PROVIDER_CONFIGURATION', 'PROVISIONING', 'ACTIVE', 'SUSPENDED', 'FAILED', 'DECOMMISSIONING', 'DECOMMISSIONED');
  END IF;
END
$$;

-- CreateEnum (guarded for recovery deployments)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InfrastructureProvisioningStatus') THEN
    CREATE TYPE "InfrastructureProvisioningStatus" AS ENUM ('PENDING', 'DOMAIN_PENDING', 'DNS_PENDING', 'SES_PENDING', 'MAILBOX_PENDING', 'SENDER_PENDING', 'READY', 'PARTIALLY_READY', 'FAILED');
  END IF;
END
$$;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DomainPurchaseRequestStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE "DomainPurchaseRequestStatus" ADD VALUE IF NOT EXISTS 'PURCHASE_PENDING';
ALTER TYPE "DomainPurchaseRequestStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "ManagedMailboxStatus" ADD VALUE IF NOT EXISTS 'PENDING_PROVIDER_CONFIGURATION';

-- CreateTable
CREATE TABLE IF NOT EXISTS "CommerceProduct" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "CommerceProductCategory" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "billingInterval" "CommerceBillingInterval" NOT NULL DEFAULT 'MONTH',
    "stripeProductId" TEXT,
    "stripePriceId" TEXT,
    "stripeSetupPriceId" TEXT,
    "commissionCategory" "CommerceProductCategory",
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CommerceProductEntitlement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "entitlementKey" TEXT NOT NULL,
    "integerValue" INTEGER,
    "booleanValue" BOOLEAN,
    "stringValue" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommerceProductEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SaasSubscriptionItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "saasSubscriptionId" TEXT,
    "commerceProductId" TEXT NOT NULL,
    "stripeSubscriptionItemId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "SaasSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaasSubscriptionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InfrastructureEntitlementOverride" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entitlementKey" TEXT NOT NULL,
    "integerValue" INTEGER,
    "booleanValue" BOOLEAN,
    "stringValue" TEXT,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InfrastructureEntitlementOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ManagedMailbox" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "managedDomainId" TEXT NOT NULL,
    "provider" "ManagedMailboxProviderKey" NOT NULL DEFAULT 'DISABLED',
    "providerMailboxId" TEXT,
    "localPart" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "status" "ManagedMailboxStatus" NOT NULL DEFAULT 'PENDING',
    "provisioningStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "inboundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "outboundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "replySyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "senderIdentityEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastHealthCheckAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedMailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MailboxProvisioningEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "managedMailboxId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "safeSummary" TEXT,
    "errorCode" TEXT,
    "safeErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailboxProvisioningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InfrastructureSenderIdentity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "managedMailboxId" TEXT,
    "managedDomainId" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "replyToAddress" TEXT,
    "sesIdentityState" TEXT NOT NULL DEFAULT 'NOT_CREATED',
    "dkimState" TEXT NOT NULL DEFAULT 'NOT_CREATED',
    "sendingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "campaignEligible" BOOLEAN NOT NULL DEFAULT false,
    "dailySendCap" INTEGER,
    "healthState" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfrastructureSenderIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DesiredDnsRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "managedDomainId" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "ttl" INTEGER,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUIRED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesiredDnsRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DnsReconciliationRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "managedDomainId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "missingRecords" JSONB NOT NULL DEFAULT '[]',
    "mismatchedRecords" JSONB NOT NULL DEFAULT '[]',
    "appliedRecords" JSONB NOT NULL DEFAULT '[]',
    "safeSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DnsReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InboundEmailMessage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "managedMailboxId" TEXT NOT NULL,
    "externalMessageId" TEXT NOT NULL,
    "internetMessageId" TEXT,
    "inReplyTo" TEXT,
    "references" TEXT,
    "sender" TEXT NOT NULL,
    "recipients" JSONB NOT NULL,
    "subject" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "bodyText" TEXT,
    "safeHtml" TEXT,
    "processingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "linkedContactId" TEXT,
    "linkedCampaignId" TEXT,
    "linkedOutboundMessageId" TEXT,
    "threadKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundEmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OutboundMessageLedger" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT,
    "contactId" TEXT,
    "senderIdentityId" TEXT,
    "managedMailboxId" TEXT,
    "managedDomainId" TEXT,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "messageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "complainedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "safeFailureMessage" TEXT,

    CONSTRAINT "OutboundMessageLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CampaignSendJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignSendJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkspaceInfrastructureUsage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "sentMessageCount" INTEGER NOT NULL DEFAULT 0,
    "managedDomainCount" INTEGER NOT NULL DEFAULT 0,
    "activeMailboxCount" INTEGER NOT NULL DEFAULT 0,
    "senderIdentityCount" INTEGER NOT NULL DEFAULT 0,
    "activeOutreachContactCount" INTEGER NOT NULL DEFAULT 0,
    "campaignSendCount" INTEGER NOT NULL DEFAULT 0,
    "providerErrorCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceInfrastructureUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InfrastructureJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "idempotencyKey" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSafeError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfrastructureJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CommissionRule" (
    "id" TEXT NOT NULL,
    "productCategory" "CommerceProductCategory" NOT NULL,
    "commissionType" "AffiliateCommissionType" NOT NULL,
    "rateBasisPoints" INTEGER,
    "fixedAmountMinor" INTEGER,
    "recurringEligible" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkspaceInfrastructureProvisioning" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" "InfrastructureProvisioningStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "stages" JSONB NOT NULL DEFAULT '{}',
    "requestedPlan" JSONB NOT NULL DEFAULT '{}',
    "safeSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceInfrastructureProvisioning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CommerceProduct_key_key" ON "CommerceProduct"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommerceProduct_category_active_idx" ON "CommerceProduct"("category", "active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommerceProduct_stripePriceId_idx" ON "CommerceProduct"("stripePriceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommerceProductEntitlement_entitlementKey_idx" ON "CommerceProductEntitlement"("entitlementKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CommerceProductEntitlement_productId_entitlementKey_key" ON "CommerceProductEntitlement"("productId", "entitlementKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SaasSubscriptionItem_stripeSubscriptionItemId_key" ON "SaasSubscriptionItem"("stripeSubscriptionItemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SaasSubscriptionItem_workspaceId_status_idx" ON "SaasSubscriptionItem"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SaasSubscriptionItem_saasSubscriptionId_idx" ON "SaasSubscriptionItem"("saasSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SaasSubscriptionItem_workspaceId_commerceProductId_stripeSu_key" ON "SaasSubscriptionItem"("workspaceId", "commerceProductId", "stripeSubscriptionItemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InfrastructureEntitlementOverride_workspaceId_entitlementKe_idx" ON "InfrastructureEntitlementOverride"("workspaceId", "entitlementKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ManagedMailbox_workspaceId_status_idx" ON "ManagedMailbox"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ManagedMailbox_managedDomainId_idx" ON "ManagedMailbox"("managedDomainId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ManagedMailbox_workspaceId_emailAddress_key" ON "ManagedMailbox"("workspaceId", "emailAddress");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MailboxProvisioningEvent_idempotencyKey_key" ON "MailboxProvisioningEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MailboxProvisioningEvent_workspaceId_status_idx" ON "MailboxProvisioningEvent"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InfrastructureSenderIdentity_workspaceId_campaignEligible_idx" ON "InfrastructureSenderIdentity"("workspaceId", "campaignEligible");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InfrastructureSenderIdentity_workspaceId_fromAddress_key" ON "InfrastructureSenderIdentity"("workspaceId", "fromAddress");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DesiredDnsRecord_managedDomainId_recordType_name_value_key" ON "DesiredDnsRecord"("managedDomainId", "recordType", "name", "value");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InboundEmailMessage_workspaceId_threadKey_idx" ON "InboundEmailMessage"("workspaceId", "threadKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InboundEmailMessage_workspaceId_managedMailboxId_externalMe_key" ON "InboundEmailMessage"("workspaceId", "managedMailboxId", "externalMessageId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OutboundMessageLedger_messageId_key" ON "OutboundMessageLedger"("messageId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OutboundMessageLedger_workspaceId_status_idx" ON "OutboundMessageLedger"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OutboundMessageLedger_providerMessageId_idx" ON "OutboundMessageLedger"("providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceInfrastructureUsage_workspaceId_periodStart_period_key" ON "WorkspaceInfrastructureUsage"("workspaceId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InfrastructureJob_idempotencyKey_key" ON "InfrastructureJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InfrastructureJob_status_nextAttemptAt_idx" ON "InfrastructureJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InfrastructureJob_workspaceId_jobType_idx" ON "InfrastructureJob"("workspaceId", "jobType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommissionRule_productCategory_active_idx" ON "CommissionRule"("productCategory", "active");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceInfrastructureProvisioning_idempotencyKey_key" ON "WorkspaceInfrastructureProvisioning"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkspaceInfrastructureProvisioning_workspaceId_status_idx" ON "WorkspaceInfrastructureProvisioning"("workspaceId", "status");

-- AddForeignKey (guarded so a rerun does not duplicate constraints)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceProductEntitlement_productId_fkey') THEN
    ALTER TABLE "CommerceProductEntitlement"
      ADD CONSTRAINT "CommerceProductEntitlement_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaasSubscriptionItem_commerceProductId_fkey') THEN
    ALTER TABLE "SaasSubscriptionItem"
      ADD CONSTRAINT "SaasSubscriptionItem_commerceProductId_fkey"
      FOREIGN KEY ("commerceProductId") REFERENCES "CommerceProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
