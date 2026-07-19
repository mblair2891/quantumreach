ALTER TABLE "CustomerOrder" ADD COLUMN "paymentVerifiedAt" TIMESTAMP(3), ADD COLUMN "paymentVerifiedById" TEXT;
CREATE TABLE "InfrastructureOrderStageEvent" ("id" TEXT PRIMARY KEY, "infrastructureOrderId" TEXT NOT NULL, "previousStage" TEXT, "newStage" TEXT NOT NULL, "eventType" TEXT NOT NULL, "actorType" TEXT NOT NULL, "actorId" TEXT, "safeMessage" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "InfrastructureOrderStageEvent_infrastructureOrderId_createdAt_idx" ON "InfrastructureOrderStageEvent"("infrastructureOrderId", "createdAt");
