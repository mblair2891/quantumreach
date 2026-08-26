-- Contact hygiene: campaign-eligibility status, flags, source merge, import preview counts.

CREATE TYPE "ContactHygieneStatus" AS ENUM ('READY', 'NEEDS_REVIEW', 'INVALID', 'SUPPRESSED');

ALTER TYPE "ContactSource" ADD VALUE IF NOT EXISTS 'WEBHOOK';

ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "hygieneStatus" "ContactHygieneStatus" NOT NULL DEFAULT 'READY';
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "hygieneFlags" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "companyRaw" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "companyDomain" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "source" "ContactSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "sourceDetail" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "Contact_workspaceId_hygieneStatus_idx" ON "Contact"("workspaceId", "hygieneStatus");

ALTER TABLE "ContactImportBatch" ADD COLUMN IF NOT EXISTS "listName" TEXT;
ALTER TABLE "ContactImportBatch" ADD COLUMN IF NOT EXISTS "readyCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ContactImportBatch" ADD COLUMN IF NOT EXISTS "needsReviewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ContactImportBatch" ADD COLUMN IF NOT EXISTS "suppressedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ContactImportBatch" ADD COLUMN IF NOT EXISTS "mergedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ContactImportBatch" ADD COLUMN IF NOT EXISTS "readyOnlyCommitted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ContactImportRow" ADD COLUMN IF NOT EXISTS "hygieneStatus" "ContactHygieneStatus" NOT NULL DEFAULT 'INVALID';
