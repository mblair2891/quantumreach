-- Persist setup-invite email delivery so webhook + confirmation do not double-send.

ALTER TABLE "AccountSetupToken" ADD COLUMN IF NOT EXISTS "emailDelivery" TEXT;
