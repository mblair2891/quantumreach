-- Core brand domain is optional reference or a separate add-on — not a sending-package slot.

ALTER TABLE "SaasWorkspaceProfile" ADD COLUMN IF NOT EXISTS "coreDomainMode" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "SaasWorkspaceProfile" ADD COLUMN IF NOT EXISTS "coreDomainName" TEXT;
