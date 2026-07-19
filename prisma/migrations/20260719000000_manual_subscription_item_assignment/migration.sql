-- Additive operator-assignment provenance and schedule fields. Existing synced items remain STRIPE.
DO $$ BEGIN
  CREATE TYPE "SaasSubscriptionItemSource" AS ENUM ('STRIPE', 'MANUAL_OPERATOR', 'COMPLIMENTARY', 'MIGRATION', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "SaasSubscriptionItem" ADD COLUMN IF NOT EXISTS "source" "SaasSubscriptionItemSource" NOT NULL DEFAULT 'STRIPE';
ALTER TABLE "SaasSubscriptionItem" ADD COLUMN IF NOT EXISTS "assignedById" TEXT;
ALTER TABLE "SaasSubscriptionItem" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SaasSubscriptionItem" ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP(3);
ALTER TABLE "SaasSubscriptionItem" ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP(3);
ALTER TABLE "SaasSubscriptionItem" ADD COLUMN IF NOT EXISTS "note" TEXT;
CREATE INDEX IF NOT EXISTS "SaasSubscriptionItem_workspaceId_commerceProductId_source_idx" ON "SaasSubscriptionItem"("workspaceId", "commerceProductId", "source");
