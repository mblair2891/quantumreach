-- Phase 2b: per-inbox Google OAuth tokens for Gmail campaign send. Not SES.

ALTER TABLE "Inbox" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'stub';
ALTER TABLE "Inbox" ADD COLUMN IF NOT EXISTS "googleConnectionStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED';
ALTER TABLE "Inbox" ADD COLUMN IF NOT EXISTS "googleAccessTokenEncrypted" TEXT;
ALTER TABLE "Inbox" ADD COLUMN IF NOT EXISTS "googleRefreshTokenEncrypted" TEXT;
ALTER TABLE "Inbox" ADD COLUMN IF NOT EXISTS "googleAccessTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "Inbox" ADD COLUMN IF NOT EXISTS "googleScopes" TEXT;
ALTER TABLE "Inbox" ADD COLUMN IF NOT EXISTS "googleConnectedAt" TIMESTAMP(3);
ALTER TABLE "Inbox" ADD COLUMN IF NOT EXISTS "googleConnectedById" TEXT;
ALTER TABLE "Inbox" ADD COLUMN IF NOT EXISTS "googleAccountEmail" TEXT;
ALTER TABLE "Inbox" ADD COLUMN IF NOT EXISTS "lastSuccessfulSendAt" TIMESTAMP(3);
ALTER TABLE "Inbox" ADD COLUMN IF NOT EXISTS "lastError" TEXT;
