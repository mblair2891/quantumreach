CREATE TYPE "MeetingRecordingPreference" AS ENUM ('NONE', 'ZOOM_CLOUD', 'LOCAL_UPLOAD');
CREATE TYPE "MeetingRecordingSource" AS ENUM ('ZOOM_CLOUD', 'LOCAL_UPLOAD', 'LEGACY_NATIVE');
CREATE TYPE "MeetingRecordingImportStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'UPLOADING', 'IMPORTING', 'AVAILABLE', 'FAILED', 'CANCELLED');
ALTER TABLE "MeetingRoom" ADD COLUMN "recordingPreference" "MeetingRecordingPreference" NOT NULL DEFAULT 'NONE', ADD COLUMN "cloudRecordingReadiness" TEXT;
UPDATE "MeetingRoom" SET "recordingPreference" = CASE WHEN "recordingPlanned" THEN 'ZOOM_CLOUD'::"MeetingRecordingPreference" ELSE 'NONE'::"MeetingRecordingPreference" END;
ALTER TABLE "MeetingRecording" ADD COLUMN "source" "MeetingRecordingSource" NOT NULL DEFAULT 'LEGACY_NATIVE', ADD COLUMN "importStatus" "MeetingRecordingImportStatus" NOT NULL DEFAULT 'NOT_REQUESTED', ADD COLUMN "originalFileName" TEXT, ADD COLUMN "uploadedById" TEXT, ADD COLUMN "uploadedAt" TIMESTAMP(3), ADD COLUMN "importedAt" TIMESTAMP(3), ADD COLUMN "checksum" TEXT, ADD COLUMN "uploadSessionExpiresAt" TIMESTAMP(3);
ALTER TABLE "MeetingRecording" ADD CONSTRAINT "MeetingRecording_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "MeetingRecording_workspaceId_meetingRoomId_source_importStatus_idx" ON "MeetingRecording"("workspaceId", "meetingRoomId", "source", "importStatus");
