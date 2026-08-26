-- Instantly campaign compliance: workspace mailing identity + per-job unsubscribe tokens.

ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "legalName" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "physicalMailingAddress" TEXT;

ALTER TABLE "OutboundCampaignJob" ADD COLUMN IF NOT EXISTS "unsubscribeToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "OutboundCampaignJob_unsubscribeToken_key" ON "OutboundCampaignJob"("unsubscribeToken");
