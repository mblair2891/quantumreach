ALTER TABLE "AnalysisRecord" ADD COLUMN "executiveNotes" TEXT;
ALTER TABLE "AnalysisRecord" ADD COLUMN "internalNotes" TEXT;
ALTER TABLE "AnalysisRecord" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "AnalysisRecord" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "AnalysisRecord" ADD COLUMN "finalizedById" TEXT;
ALTER TABLE "AnalysisRecord" ADD COLUMN "finalizedAt" TIMESTAMP(3);

ALTER TABLE "ROIModel" ADD COLUMN "estimatedCostOfDelay" DECIMAL(18,2);
ALTER TABLE "ROIModel" ADD COLUMN "timeHorizonMonths" INTEGER;

ALTER TABLE "CostOfInactionModel" ADD CONSTRAINT "CostOfInactionModel_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AnalysisRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExecutiveReport" ADD COLUMN "diagnosticSessionId" TEXT;
ALTER TABLE "ExecutiveReport" ADD COLUMN "opportunityId" TEXT;
ALTER TABLE "ExecutiveReport" ADD COLUMN "companyId" TEXT;
ALTER TABLE "ExecutiveReport" ADD COLUMN "contactId" TEXT;
ALTER TABLE "ExecutiveReport" ADD COLUMN "leadId" TEXT;
ALTER TABLE "ExecutiveReport" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "ExecutiveReport" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "ExecutiveReport" ADD COLUMN "finalizedById" TEXT;
ALTER TABLE "ExecutiveReport" ADD COLUMN "finalizedAt" TIMESTAMP(3);
CREATE INDEX "ExecutiveReport_workspaceId_opportunityId_idx" ON "ExecutiveReport"("workspaceId", "opportunityId");

ALTER TABLE "StrategicRoadmap" ADD COLUMN "reportId" TEXT;
ALTER TABLE "StrategicRoadmap" ADD COLUMN "opportunityId" TEXT;
ALTER TABLE "StrategicRoadmap" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "StrategicRoadmap" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "StrategicRoadmap" ADD COLUMN "finalizedById" TEXT;
ALTER TABLE "StrategicRoadmap" ADD COLUMN "finalizedAt" TIMESTAMP(3);
CREATE INDEX "StrategicRoadmap_workspaceId_opportunityId_idx" ON "StrategicRoadmap"("workspaceId", "opportunityId");

ALTER TABLE "Proposal" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Proposal" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "Proposal" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Proposal" ADD COLUMN "finalizedById" TEXT;
ALTER TABLE "Proposal" ADD COLUMN "finalizedAt" TIMESTAMP(3);
