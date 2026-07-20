CREATE TABLE "FunnelEvent" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "userId" TEXT,
  "acquisitionSessionId" TEXT,
  "customerOrderId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FunnelEvent_eventType_createdAt_idx" ON "FunnelEvent"("eventType", "createdAt");
CREATE INDEX "FunnelEvent_userId_createdAt_idx" ON "FunnelEvent"("userId", "createdAt");
