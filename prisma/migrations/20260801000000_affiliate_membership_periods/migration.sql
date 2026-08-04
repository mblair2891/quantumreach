CREATE TYPE "AffiliateMembershipPeriodStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ENDED');
CREATE TYPE "AffiliateCodeLifecycleStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'RETIRED');
CREATE TYPE "AffiliateReferralAttributionStatus" AS ENUM ('CAPTURED', 'LOCKED', 'INVALIDATED');

CREATE TABLE "AffiliateParticipant" (
  "id" TEXT NOT NULL, "userId" TEXT, "email" TEXT NOT NULL, "displayName" TEXT NOT NULL,
  "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AffiliateParticipant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AffiliateParticipant_userId_key" ON "AffiliateParticipant"("userId");
CREATE UNIQUE INDEX "AffiliateParticipant_email_key" ON "AffiliateParticipant"("email");

CREATE TABLE "AffiliateMembershipPeriod" (
  "id" TEXT NOT NULL, "participantId" TEXT NOT NULL,
  "status" "AffiliateMembershipPeriodStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "endedAt" TIMESTAMP(3),
  "terminationReason" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AffiliateMembershipPeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AffiliateMembershipPeriod_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "AffiliateParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AffiliateMembershipPeriod_participantId_status_idx" ON "AffiliateMembershipPeriod"("participantId", "status");
CREATE INDEX "AffiliateMembershipPeriod_status_startedAt_idx" ON "AffiliateMembershipPeriod"("status", "startedAt");
CREATE UNIQUE INDEX "AffiliateMembershipPeriod_one_open_idx" ON "AffiliateMembershipPeriod"("participantId") WHERE "status" IN ('ACTIVE','SUSPENDED');

CREATE TABLE "AffiliateMembershipCode" (
  "id" TEXT NOT NULL, "membershipPeriodId" TEXT NOT NULL, "code" TEXT NOT NULL, "normalizedCode" TEXT NOT NULL,
  "status" "AffiliateCodeLifecycleStatus" NOT NULL DEFAULT 'ACTIVE', "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retiredAt" TIMESTAMP(3), "retirementReason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AffiliateMembershipCode_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AffiliateMembershipCode_membershipPeriodId_fkey" FOREIGN KEY ("membershipPeriodId") REFERENCES "AffiliateMembershipPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AffiliateMembershipCode_membershipPeriodId_key" ON "AffiliateMembershipCode"("membershipPeriodId");
CREATE UNIQUE INDEX "AffiliateMembershipCode_normalizedCode_key" ON "AffiliateMembershipCode"("normalizedCode");
CREATE INDEX "AffiliateMembershipCode_status_normalizedCode_idx" ON "AffiliateMembershipCode"("status", "normalizedCode");

CREATE TABLE "AffiliateReferralAttribution" (
  "id" TEXT NOT NULL, "affiliateMembershipPeriodId" TEXT NOT NULL, "affiliateCodeId" TEXT NOT NULL,
  "acquisitionSessionId" TEXT, "orderId" TEXT, "customerUserId" TEXT, "workspaceId" TEXT,
  "status" "AffiliateReferralAttributionStatus" NOT NULL DEFAULT 'CAPTURED',
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lockedAt" TIMESTAMP(3),
  "invalidatedAt" TIMESTAMP(3), "invalidationReason" TEXT, "sourceMetadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AffiliateReferralAttribution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AffiliateReferralAttribution_membership_fkey" FOREIGN KEY ("affiliateMembershipPeriodId") REFERENCES "AffiliateMembershipPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AffiliateReferralAttribution_code_fkey" FOREIGN KEY ("affiliateCodeId") REFERENCES "AffiliateMembershipCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AffiliateReferralAttribution_acquisitionSessionId_status_idx" ON "AffiliateReferralAttribution"("acquisitionSessionId", "status");
CREATE INDEX "AffiliateReferralAttribution_orderId_status_idx" ON "AffiliateReferralAttribution"("orderId", "status");
CREATE INDEX "AffiliateReferralAttribution_customerUserId_status_idx" ON "AffiliateReferralAttribution"("customerUserId", "status");
CREATE INDEX "AffiliateReferralAttribution_workspaceId_status_idx" ON "AffiliateReferralAttribution"("workspaceId", "status");
CREATE INDEX "AffiliateReferralAttribution_membership_captured_idx" ON "AffiliateReferralAttribution"("affiliateMembershipPeriodId", "capturedAt");
CREATE UNIQUE INDEX "AffiliateReferralAttribution_one_current_session_idx" ON "AffiliateReferralAttribution"("acquisitionSessionId") WHERE "acquisitionSessionId" IS NOT NULL AND "status" IN ('CAPTURED','LOCKED');
CREATE UNIQUE INDEX "AffiliateReferralAttribution_one_locked_order_idx" ON "AffiliateReferralAttribution"("orderId") WHERE "orderId" IS NOT NULL AND "status" = 'LOCKED';
CREATE UNIQUE INDEX "AffiliateReferralAttribution_one_locked_customer_idx" ON "AffiliateReferralAttribution"("customerUserId") WHERE "customerUserId" IS NOT NULL AND "status" = 'LOCKED';
CREATE UNIQUE INDEX "AffiliateReferralAttribution_one_locked_workspace_idx" ON "AffiliateReferralAttribution"("workspaceId") WHERE "workspaceId" IS NOT NULL AND "status" = 'LOCKED';
