-- Platform-wide operator mutations do not belong to a subscriber workspace.
-- Existing workspace-scoped audit rows and their foreign-key behavior are preserved.
ALTER TABLE "AuditLog" ALTER COLUMN "workspaceId" DROP NOT NULL;
CREATE INDEX "AuditLog_platform_scope_createdAt_idx" ON "AuditLog"("createdAt") WHERE "workspaceId" IS NULL;
