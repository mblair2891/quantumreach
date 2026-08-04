CREATE TYPE "CouponRedemptionStatus" AS ENUM ('APPLIED','RESERVED','REDEEMED','RELEASED','REVERSED','EXPIRED');
ALTER TABLE "CustomerOrder" ADD COLUMN "acceptedCouponSnapshot" JSONB;
CREATE TABLE "CommercialCoupon" (
  "id" TEXT PRIMARY KEY, "code" TEXT NOT NULL, "normalizedCode" TEXT NOT NULL UNIQUE,
  "displayName" TEXT NOT NULL, "description" TEXT, "active" BOOLEAN NOT NULL DEFAULT false,
  "validFrom" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "percentageOff" INTEGER NOT NULL,
  "recurringDiscountMonths" INTEGER, "trialDays" INTEGER, "minimumOrderAmountCents" INTEGER NOT NULL DEFAULT 0,
  "maximumTotalRedemptions" INTEGER, "maximumRedemptionsPerCustomer" INTEGER,
  "stripeCouponId" TEXT, "stripePromotionCodeId" TEXT, "version" INTEGER NOT NULL DEFAULT 1,
  "eligiblePackageKeys" TEXT[] NOT NULL, "eligibleProductKeys" TEXT[] NOT NULL, "eligibleChargeTypes" TEXT[] NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "retiredAt" TIMESTAMP(3),
  CONSTRAINT "CommercialCoupon_percentageOff_check" CHECK ("percentageOff" > 0 AND "percentageOff" <= 100),
  CONSTRAINT "CommercialCoupon_recurringMonths_check" CHECK ("recurringDiscountMonths" IS NULL OR "recurringDiscountMonths" > 0),
  CONSTRAINT "CommercialCoupon_trialDays_check" CHECK ("trialDays" IS NULL OR "trialDays" > 0),
  CONSTRAINT "CommercialCoupon_minimum_check" CHECK ("minimumOrderAmountCents" >= 0),
  CONSTRAINT "CommercialCoupon_limits_check" CHECK (("maximumTotalRedemptions" IS NULL OR "maximumTotalRedemptions" > 0) AND ("maximumRedemptionsPerCustomer" IS NULL OR "maximumRedemptionsPerCustomer" > 0))
);
CREATE TABLE "CouponRedemption" (
  "id" TEXT PRIMARY KEY, "couponId" TEXT NOT NULL REFERENCES "CommercialCoupon"("id") ON DELETE RESTRICT,
  "acquisitionSessionId" TEXT NOT NULL, "customerAccountId" TEXT, "orderId" TEXT,
  "normalizedCodeSnapshot" TEXT NOT NULL, "couponVersion" INTEGER NOT NULL,
  "status" "CouponRedemptionStatus" NOT NULL DEFAULT 'APPLIED', "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reservedAt" TIMESTAMP(3), "redeemedAt" TIMESTAMP(3), "releasedAt" TIMESTAMP(3), "reversedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3), "idempotencyKey" TEXT NOT NULL UNIQUE, "calculationSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "CommercialCoupon_active_validFrom_expiresAt_idx" ON "CommercialCoupon"("active","validFrom","expiresAt");
CREATE INDEX "CommercialCoupon_retiredAt_idx" ON "CommercialCoupon"("retiredAt");
CREATE INDEX "CouponRedemption_couponId_status_idx" ON "CouponRedemption"("couponId","status");
CREATE INDEX "CouponRedemption_acquisitionSessionId_status_idx" ON "CouponRedemption"("acquisitionSessionId","status");
CREATE INDEX "CouponRedemption_customerAccountId_status_idx" ON "CouponRedemption"("customerAccountId","status");
CREATE INDEX "CouponRedemption_orderId_idx" ON "CouponRedemption"("orderId");
CREATE UNIQUE INDEX "CouponRedemption_one_active_acquisition_idx" ON "CouponRedemption"("acquisitionSessionId") WHERE "status" IN ('APPLIED','RESERVED');
