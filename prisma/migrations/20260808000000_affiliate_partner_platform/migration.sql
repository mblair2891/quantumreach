-- Affiliate partner platform: program config + partner-visible referral fee fields

CREATE TABLE IF NOT EXISTS "AffiliateProgramConfig" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "firstPaymentRateBps" INTEGER NOT NULL DEFAULT 2000,
    "recurringRateBps" INTEGER NOT NULL DEFAULT 1000,
    "setupFeesCommissionable" BOOLEAN NOT NULL DEFAULT false,
    "holdDays" INTEGER NOT NULL DEFAULT 14,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateProgramConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AffiliateProgramConfig" ("id", "enabled", "firstPaymentRateBps", "recurringRateBps", "setupFeesCommissionable", "holdDays", "createdAt", "updatedAt")
VALUES ('default', true, 2000, 1000, false, 14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "AffiliateReferralAttribution" ADD COLUMN IF NOT EXISTS "partnerVisible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AffiliateReferralAttribution" ADD COLUMN IF NOT EXISTS "commissionable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AffiliateReferralAttribution" ADD COLUMN IF NOT EXISTS "partnerStatus" TEXT;
ALTER TABLE "AffiliateReferralAttribution" ADD COLUMN IF NOT EXISTS "expectedFeeCents" INTEGER;
ALTER TABLE "AffiliateReferralAttribution" ADD COLUMN IF NOT EXISTS "firstPaymentGrossCents" INTEGER;
ALTER TABLE "AffiliateReferralAttribution" ADD COLUMN IF NOT EXISTS "rateBpsSnapshot" INTEGER;
ALTER TABLE "AffiliateReferralAttribution" ADD COLUMN IF NOT EXISTS "packageKey" TEXT;
ALTER TABLE "AffiliateReferralAttribution" ADD COLUMN IF NOT EXISTS "packageName" TEXT;
ALTER TABLE "AffiliateReferralAttribution" ADD COLUMN IF NOT EXISTS "referredDisplayLabel" TEXT;
ALTER TABLE "AffiliateReferralAttribution" ADD COLUMN IF NOT EXISTS "feeCalculatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "AffiliateReferralAttribution_partnerVisible_affiliateMembershipPeriodId_capturedAt_idx"
  ON "AffiliateReferralAttribution"("partnerVisible", "affiliateMembershipPeriodId", "capturedAt");
