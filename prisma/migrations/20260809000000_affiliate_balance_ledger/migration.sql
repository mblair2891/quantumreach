-- Affiliate balance ledger: expected paid-out date + manual payout tracking

ALTER TABLE "AffiliateReferralAttribution" ADD COLUMN IF NOT EXISTS "ledgerStatus" TEXT;
ALTER TABLE "AffiliateReferralAttribution" ADD COLUMN IF NOT EXISTS "expectedPaidOutAt" TIMESTAMP(3);
ALTER TABLE "AffiliateReferralAttribution" ADD COLUMN IF NOT EXISTS "paidOutAt" TIMESTAMP(3);
ALTER TABLE "AffiliateReferralAttribution" ADD COLUMN IF NOT EXISTS "paidOutById" TEXT;
ALTER TABLE "AffiliateReferralAttribution" ADD COLUMN IF NOT EXISTS "paidOutNote" TEXT;

-- Backfill ledger fields for existing partner-visible commissionable rows
UPDATE "AffiliateReferralAttribution"
SET
  "ledgerStatus" = CASE
    WHEN "partnerStatus" = 'PAID' THEN 'PAID'
    WHEN "partnerStatus" = 'ACTIVE' THEN 'AVAILABLE'
    WHEN "partnerStatus" = 'PENDING' THEN 'PENDING'
    WHEN "commissionable" = true AND "partnerVisible" = true THEN 'PENDING'
    ELSE "ledgerStatus"
  END,
  "expectedPaidOutAt" = COALESCE(
    "expectedPaidOutAt",
    CASE
      WHEN "feeCalculatedAt" IS NOT NULL THEN "feeCalculatedAt" + INTERVAL '14 days'
      WHEN "lockedAt" IS NOT NULL THEN "lockedAt" + INTERVAL '14 days'
      ELSE "capturedAt" + INTERVAL '14 days'
    END
  )
WHERE "partnerVisible" = true AND "commissionable" = true;

CREATE INDEX IF NOT EXISTS "AffiliateReferralAttribution_ledgerStatus_expectedPaidOutAt_idx"
  ON "AffiliateReferralAttribution"("ledgerStatus", "expectedPaidOutAt");

CREATE INDEX IF NOT EXISTS "AffiliateReferralAttribution_commissionable_ledgerStatus_idx"
  ON "AffiliateReferralAttribution"("commissionable", "ledgerStatus");
