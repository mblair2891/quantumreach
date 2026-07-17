CREATE TYPE "SaasSubscriberType" AS ENUM ('STUDENT', 'DIRECT_CUSTOMER', 'AFFILIATE_RESELLER', 'REFERRED_CLIENT_COMPANY');

CREATE TYPE "SkoolMembershipStatus" AS ENUM ('UNKNOWN', 'ACTIVE', 'INACTIVE', 'CANCELED', 'MANUALLY_VERIFIED');

CREATE TYPE "SaasBillingMode" AS ENUM ('MONTHLY', 'YEARLY');

CREATE TYPE "SaasSubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'INCOMPLETE');

CREATE TYPE "SaasProvisioningStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING');

CREATE TYPE "AffiliateStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED');

CREATE TYPE "AffiliateCommissionType" AS ENUM ('PERCENT_RECURRING', 'PERCENT_ONE_TIME', 'FIXED_ONE_TIME');

CREATE TYPE "AffiliateCommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAYABLE', 'PAID', 'REVERSED', 'VOID');

CREATE TYPE "SaasWorkspaceType" AS ENUM ('INTERNAL', 'STUDENT_SUBSCRIBER', 'DIRECT_CUSTOMER', 'REFERRED_CLIENT_COMPANY');

CREATE TABLE "SaasSubscriberProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "subscriberType" "SaasSubscriberType" NOT NULL DEFAULT 'STUDENT',
    "onboardingProgress" JSONB NOT NULL DEFAULT '{}',
    "affiliateStatus" "AffiliateStatus",
    "referredClientCount" INTEGER NOT NULL DEFAULT 0,
    "recurringCommissionCents" INTEGER NOT NULL DEFAULT 0,
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaasSubscriberProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SkoolMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skoolGroupId" TEXT,
    "skoolMemberId" TEXT,
    "skoolMembershipStatus" "SkoolMembershipStatus" NOT NULL DEFAULT 'UNKNOWN',
    "skoolJoinedAt" TIMESTAMP(3),
    "skoolLastSyncedAt" TIMESTAMP(3),
    "cohort" TEXT,
    "manuallyVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkoolMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaasPlan" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "stripePriceId" TEXT,
    "billingMode" "SaasBillingMode" NOT NULL DEFAULT 'MONTHLY',
    "entitlements" JSONB NOT NULL DEFAULT '{}',
    "usageLimits" JSONB NOT NULL DEFAULT '{}',
    "affiliateEligible" BOOLEAN NOT NULL DEFAULT false,
    "whiteLabelEligible" BOOLEAN NOT NULL DEFAULT false,
    "maxClientCompanyWorkspaces" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaasPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaasSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "planKey" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripeSubscriptionItemId" TEXT,
    "status" "SaasSubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "currentPeriodEnd" TIMESTAMP(3),
    "affiliateAttributionId" TEXT,
    "commissionEligible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaasSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriberProvisioningEvent" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "workspaceId" TEXT,
    "status" "SaasProvisioningStatus" NOT NULL DEFAULT 'PENDING',
    "eventType" TEXT NOT NULL,
    "safeMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriberProvisioningEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateAccount" (
    "id" TEXT NOT NULL,
    "subscriberUserId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "affiliateCode" TEXT NOT NULL,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'PENDING',
    "commissionType" "AffiliateCommissionType" NOT NULL DEFAULT 'PERCENT_RECURRING',
    "commissionRateBps" INTEGER NOT NULL DEFAULT 0,
    "payoutThresholdCents" INTEGER NOT NULL DEFAULT 0,
    "payoutMethodStatus" TEXT NOT NULL DEFAULT 'MANUAL',
    "approvedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateAttribution" (
    "id" TEXT NOT NULL,
    "affiliateAccountId" TEXT NOT NULL,
    "prospectUserId" TEXT,
    "referralCode" TEXT NOT NULL,
    "policy" TEXT NOT NULL DEFAULT 'LAST_TOUCH_60_DAYS',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateAttribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateClick" (
    "id" TEXT NOT NULL,
    "affiliateAccountId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateConversion" (
    "id" TEXT NOT NULL,
    "affiliateAttributionId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "customerUserId" TEXT NOT NULL,
    "grossCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateConversion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateCommission" (
    "id" TEXT NOT NULL,
    "affiliateAccountId" TEXT NOT NULL,
    "referredCustomerUserId" TEXT,
    "invoiceId" TEXT,
    "paymentIntentId" TEXT,
    "grossCents" INTEGER NOT NULL,
    "commissionRateBps" INTEGER NOT NULL,
    "commissionCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "AffiliateCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateCommission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateCommissionAdjustment" (
    "id" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "adjustmentCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "auditNote" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateCommissionAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliatePayout" (
    "id" TEXT NOT NULL,
    "affiliateAccountId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'MANUAL_PENDING',
    "auditNote" TEXT,
    "markedPaidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliatePayout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceBranding" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandName" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "faviconUrl" TEXT,
    "supportEmail" TEXT,
    "supportUrl" TEXT,
    "loginDisplayName" TEXT,
    "portalDisplayName" TEXT,
    "schedulingBrandName" TEXT,
    "proposalBrandName" TEXT,
    "contractBrandName" TEXT,
    "customApplicationDomain" TEXT,
    "customPortalDomain" TEXT,
    "brandingSourceWorkspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceBranding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaasWorkspaceProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workspaceType" "SaasWorkspaceType" NOT NULL DEFAULT 'DIRECT_CUSTOMER',
    "referringAffiliateId" TEXT,
    "referringWorkspaceId" TEXT,
    "brandingSourceWorkspaceId" TEXT,
    "referralAttributionId" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaasWorkspaceProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SaasSubscriberProfile_userId_key" ON "SaasSubscriberProfile"("userId");
CREATE INDEX "SaasSubscriberProfile_subscriberType_suspendedAt_idx" ON "SaasSubscriberProfile"("subscriberType", "suspendedAt");
CREATE UNIQUE INDEX "SkoolMembership_userId_key" ON "SkoolMembership"("userId");
CREATE UNIQUE INDEX "SaasPlan_key_key" ON "SaasPlan"("key");
CREATE UNIQUE INDEX "SaasSubscription_stripeSubscriptionId_key" ON "SaasSubscription"("stripeSubscriptionId");
CREATE INDEX "SaasSubscription_userId_status_idx" ON "SaasSubscription"("userId", "status");
CREATE INDEX "SaasSubscription_workspaceId_idx" ON "SaasSubscription"("workspaceId");
CREATE UNIQUE INDEX "SubscriberProvisioningEvent_idempotencyKey_key" ON "SubscriberProvisioningEvent"("idempotencyKey");
CREATE INDEX "SubscriberProvisioningEvent_status_createdAt_idx" ON "SubscriberProvisioningEvent"("status", "createdAt");
CREATE UNIQUE INDEX "AffiliateAccount_affiliateCode_key" ON "AffiliateAccount"("affiliateCode");
CREATE INDEX "AffiliateAttribution_prospectUserId_idx" ON "AffiliateAttribution"("prospectUserId");
CREATE INDEX "AffiliateAttribution_affiliateAccountId_createdAt_idx" ON "AffiliateAttribution"("affiliateAccountId", "createdAt");
CREATE INDEX "AffiliateClick_affiliateAccountId_createdAt_idx" ON "AffiliateClick"("affiliateAccountId", "createdAt");
CREATE INDEX "AffiliateConversion_affiliateAttributionId_idx" ON "AffiliateConversion"("affiliateAttributionId");
CREATE INDEX "AffiliateCommission_affiliateAccountId_status_idx" ON "AffiliateCommission"("affiliateAccountId", "status");
CREATE INDEX "AffiliatePayout_affiliateAccountId_status_idx" ON "AffiliatePayout"("affiliateAccountId", "status");
CREATE UNIQUE INDEX "WorkspaceBranding_workspaceId_key" ON "WorkspaceBranding"("workspaceId");
CREATE UNIQUE INDEX "SaasWorkspaceProfile_workspaceId_key" ON "SaasWorkspaceProfile"("workspaceId");
