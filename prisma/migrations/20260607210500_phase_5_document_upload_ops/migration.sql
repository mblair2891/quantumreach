-- Phase 5 document upload metadata and safe version lineage.
ALTER TABLE "KnowledgeDocument" ADD COLUMN "sourceFileSizeBytes" INTEGER;
ALTER TABLE "KnowledgeDocument" ADD COLUMN "storageKey" TEXT;
ALTER TABLE "KnowledgeDocument" ADD COLUMN "parentDocumentId" TEXT;
ALTER TABLE "KnowledgeDocument" ADD COLUMN "supersedesDocumentId" TEXT;

ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_parentDocumentId_fkey" FOREIGN KEY ("parentDocumentId") REFERENCES "KnowledgeDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_supersedesDocumentId_fkey" FOREIGN KEY ("supersedesDocumentId") REFERENCES "KnowledgeDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "KnowledgeDocument_workspaceId_parentDocumentId_idx" ON "KnowledgeDocument"("workspaceId", "parentDocumentId");
CREATE INDEX "KnowledgeDocument_workspaceId_supersedesDocumentId_idx" ON "KnowledgeDocument"("workspaceId", "supersedesDocumentId");
