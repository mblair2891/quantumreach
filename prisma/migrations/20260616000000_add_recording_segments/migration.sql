-- Add segmented recording lifecycle support without modifying existing recording rows.
ALTER TYPE "MeetingRecordingStatus" ADD VALUE IF NOT EXISTS 'PAUSING';
ALTER TYPE "MeetingRecordingStatus" ADD VALUE IF NOT EXISTS 'PAUSED';
ALTER TYPE "MeetingRecordingStatus" ADD VALUE IF NOT EXISTS 'RESUMING';

ALTER TYPE "MeetingRecordingEventType" ADD VALUE IF NOT EXISTS 'RECORDING_PAUSE_REQUESTED';
ALTER TYPE "MeetingRecordingEventType" ADD VALUE IF NOT EXISTS 'RECORDING_PAUSED';
ALTER TYPE "MeetingRecordingEventType" ADD VALUE IF NOT EXISTS 'RECORDING_RESUME_REQUESTED';
ALTER TYPE "MeetingRecordingEventType" ADD VALUE IF NOT EXISTS 'RECORDING_RESUMED';
ALTER TYPE "MeetingRecordingEventType" ADD VALUE IF NOT EXISTS 'RECORDING_SEGMENT_STARTED';
ALTER TYPE "MeetingRecordingEventType" ADD VALUE IF NOT EXISTS 'RECORDING_SEGMENT_FINALIZED';
ALTER TYPE "MeetingRecordingEventType" ADD VALUE IF NOT EXISTS 'RECORDING_SEGMENT_FAILED';

CREATE TYPE "MeetingRecordingSegmentStatus" AS ENUM ('STARTING', 'RECORDING', 'STOPPING', 'PROCESSING', 'AVAILABLE', 'FAILED', 'CANCELLED');

CREATE TABLE "MeetingRecordingSegment" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "meetingRoomId" TEXT NOT NULL,
  "recordingId" TEXT NOT NULL,
  "segmentNumber" INTEGER NOT NULL,
  "providerEgressId" TEXT,
  "status" "MeetingRecordingSegmentStatus" NOT NULL DEFAULT 'STARTING',
  "storageKey" TEXT,
  "bucketName" TEXT,
  "fileName" TEXT,
  "mimeType" TEXT,
  "fileSizeBytes" BIGINT,
  "durationSeconds" INTEGER,
  "startedAt" TIMESTAMP(3),
  "stoppedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "safeFailureMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingRecordingSegment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MeetingRecordingSegment_providerEgressId_key" ON "MeetingRecordingSegment"("providerEgressId");
CREATE UNIQUE INDEX "MeetingRecordingSegment_recordingId_segmentNumber_key" ON "MeetingRecordingSegment"("recordingId", "segmentNumber");
CREATE INDEX "MeetingRecordingSegment_workspaceId_meetingRoomId_status_idx" ON "MeetingRecordingSegment"("workspaceId", "meetingRoomId", "status");
CREATE INDEX "MeetingRecordingSegment_recordingId_status_idx" ON "MeetingRecordingSegment"("recordingId", "status");
ALTER TABLE "MeetingRecordingSegment" ADD CONSTRAINT "MeetingRecordingSegment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeetingRecordingSegment" ADD CONSTRAINT "MeetingRecordingSegment_meetingRoomId_fkey" FOREIGN KEY ("meetingRoomId") REFERENCES "MeetingRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeetingRecordingSegment" ADD CONSTRAINT "MeetingRecordingSegment_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "MeetingRecording"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
