-- Preview/local-only payment evidence. This record is distinct from Stripe and complimentary access.
ALTER TYPE "SaasSubscriptionItemSource" ADD VALUE 'SIMULATED_TEST';

CREATE TABLE "SimulatedPaymentRecord" (
  "id" TEXT NOT NULL,
  "customerOrderId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'SIMULATED_TEST',
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "correlationId" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "packageKey" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "workspaceId" TEXT,
  "safeError" TEXT,
  "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SimulatedPaymentRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SimulatedPaymentRecord_customerOrderId_fkey" FOREIGN KEY ("customerOrderId") REFERENCES "CustomerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SimulatedPaymentRecord_customerOrderId_key" ON "SimulatedPaymentRecord"("customerOrderId");
CREATE UNIQUE INDEX "SimulatedPaymentRecord_correlationId_key" ON "SimulatedPaymentRecord"("correlationId");
CREATE INDEX "SimulatedPaymentRecord_source_status_idx" ON "SimulatedPaymentRecord"("source", "status");
CREATE INDEX "SimulatedPaymentRecord_actorUserId_initiatedAt_idx" ON "SimulatedPaymentRecord"("actorUserId", "initiatedAt");
