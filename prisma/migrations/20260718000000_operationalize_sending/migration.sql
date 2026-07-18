ALTER TYPE "DomainPurchaseRequestStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE "DomainPurchaseRequestStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "DomainPurchaseRequestStatus" ADD VALUE IF NOT EXISTS 'PURCHASE_PENDING';
ALTER TYPE "ManagedMailboxStatus" ADD VALUE IF NOT EXISTS 'PENDING_PROVIDER_CONFIGURATION';

CREATE TABLE IF NOT EXISTS "InfrastructureJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT,
  "jobType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "idempotencyKey" TEXT NOT NULL,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSafeError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "InfrastructureJob_idempotencyKey_key" ON "InfrastructureJob"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "InfrastructureJob_status_nextAttemptAt_idx" ON "InfrastructureJob"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "InfrastructureJob_workspaceId_jobType_idx" ON "InfrastructureJob"("workspaceId", "jobType");
