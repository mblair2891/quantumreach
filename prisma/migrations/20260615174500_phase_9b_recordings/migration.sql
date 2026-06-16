-- CreateEnum
CREATE TYPE "MeetingRecordingStatus" AS ENUM ('CONSENT_REQUIRED', 'READY', 'STARTING', 'RECORDING', 'STOPPING', 'PROCESSING', 'AVAILABLE', 'FAILED', 'CANCELLED', 'DELETED');

-- CreateEnum
CREATE TYPE "RecordingConsentStatus" AS ENUM ('PENDING', 'CONSENTED', 'DECLINED', 'REVOKED', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "MeetingTranscriptionStatus" AS ENUM ('NOT_REQUESTED', 'QUEUED', 'PROCESSING', 'REVIEW_REQUIRED', 'APPROVED', 'FAILED');

-- CreateEnum
CREATE TYPE "MeetingTranscriptionJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'RETRY_WAIT', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MeetingRecordingEventType" AS ENUM ('CONSENT_REQUESTED', 'CONSENT_GRANTED', 'CONSENT_DECLINED', 'CONSENT_REVOKED', 'RECORDING_START_REQUESTED', 'RECORDING_STARTED', 'RECORDING_STOP_REQUESTED', 'RECORDING_STOPPED', 'RECORDING_PROCESSING', 'RECORDING_AVAILABLE', 'RECORDING_FAILED', 'TRANSCRIPTION_QUEUED', 'TRANSCRIPTION_STARTED', 'TRANSCRIPTION_COMPLETED', 'TRANSCRIPTION_FAILED', 'TRANSCRIPT_EDITED', 'TRANSCRIPT_APPROVED', 'CALL_SESSION_UPDATED', 'RECORDING_DOWNLOADED', 'RECORDING_DELETED');

-- CreateTable
CREATE TABLE "MeetingRecording" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "meetingRoomId" TEXT NOT NULL,
    "callSessionId" TEXT,
    "requestedById" TEXT NOT NULL,
    "startedById" TEXT,
    "stoppedById" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'LIVEKIT_EGRESS',
    "providerEgressId" TEXT,
    "status" "MeetingRecordingStatus" NOT NULL DEFAULT 'CONSENT_REQUIRED',
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
    "failureCode" TEXT,
    "safeFailureMessage" TEXT,
    "transcriptionStatus" "MeetingTranscriptionStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "transcriptText" TEXT,
    "transcriptEditedText" TEXT,
    "transcriptApprovedAt" TIMESTAMP(3),
    "transcriptApprovedById" TEXT,
    "transcriptModel" TEXT,
    "transcriptLanguage" TEXT,
    "transcriptDurationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingRecording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingRecordingConsent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "meetingRoomId" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "meetingParticipantId" TEXT,
    "userId" TEXT,
    "livekitIdentity" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "consentStatus" "RecordingConsentStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingRecordingConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingRecordingEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "meetingRoomId" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "type" "MeetingRecordingEventType" NOT NULL,
    "eventKey" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingRecordingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingTranscriptionJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "meetingRoomId" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "status" "MeetingTranscriptionJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "safeFailureMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingTranscriptionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingRecording_providerEgressId_key" ON "MeetingRecording"("providerEgressId");

-- CreateIndex
CREATE INDEX "MeetingRecording_workspaceId_meetingRoomId_status_idx" ON "MeetingRecording"("workspaceId", "meetingRoomId", "status");

-- CreateIndex
CREATE INDEX "MeetingRecording_workspaceId_transcriptionStatus_idx" ON "MeetingRecording"("workspaceId", "transcriptionStatus");

-- CreateIndex
CREATE INDEX "MeetingRecording_workspaceId_callSessionId_idx" ON "MeetingRecording"("workspaceId", "callSessionId");

-- CreateIndex
CREATE INDEX "MeetingRecordingConsent_workspaceId_meetingRoomId_consentSt_idx" ON "MeetingRecordingConsent"("workspaceId", "meetingRoomId", "consentStatus");

-- CreateIndex
CREATE INDEX "MeetingRecordingConsent_meetingParticipantId_idx" ON "MeetingRecordingConsent"("meetingParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingRecordingConsent_recordingId_livekitIdentity_key" ON "MeetingRecordingConsent"("recordingId", "livekitIdentity");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingRecordingEvent_eventKey_key" ON "MeetingRecordingEvent"("eventKey");

-- CreateIndex
CREATE INDEX "MeetingRecordingEvent_workspaceId_meetingRoomId_createdAt_idx" ON "MeetingRecordingEvent"("workspaceId", "meetingRoomId", "createdAt");

-- CreateIndex
CREATE INDEX "MeetingRecordingEvent_recordingId_type_idx" ON "MeetingRecordingEvent"("recordingId", "type");

-- CreateIndex
CREATE INDEX "MeetingTranscriptionJob_workspaceId_status_nextAttemptAt_idx" ON "MeetingTranscriptionJob"("workspaceId", "status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "MeetingTranscriptionJob_recordingId_status_idx" ON "MeetingTranscriptionJob"("recordingId", "status");

-- AddForeignKey
ALTER TABLE "MeetingRecording" ADD CONSTRAINT "MeetingRecording_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRecording" ADD CONSTRAINT "MeetingRecording_meetingRoomId_fkey" FOREIGN KEY ("meetingRoomId") REFERENCES "MeetingRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRecording" ADD CONSTRAINT "MeetingRecording_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "CallSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRecording" ADD CONSTRAINT "MeetingRecording_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRecording" ADD CONSTRAINT "MeetingRecording_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRecording" ADD CONSTRAINT "MeetingRecording_stoppedById_fkey" FOREIGN KEY ("stoppedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRecording" ADD CONSTRAINT "MeetingRecording_transcriptApprovedById_fkey" FOREIGN KEY ("transcriptApprovedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRecordingConsent" ADD CONSTRAINT "MeetingRecordingConsent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRecordingConsent" ADD CONSTRAINT "MeetingRecordingConsent_meetingRoomId_fkey" FOREIGN KEY ("meetingRoomId") REFERENCES "MeetingRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRecordingConsent" ADD CONSTRAINT "MeetingRecordingConsent_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "MeetingRecording"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRecordingConsent" ADD CONSTRAINT "MeetingRecordingConsent_meetingParticipantId_fkey" FOREIGN KEY ("meetingParticipantId") REFERENCES "MeetingParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRecordingConsent" ADD CONSTRAINT "MeetingRecordingConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRecordingEvent" ADD CONSTRAINT "MeetingRecordingEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRecordingEvent" ADD CONSTRAINT "MeetingRecordingEvent_meetingRoomId_fkey" FOREIGN KEY ("meetingRoomId") REFERENCES "MeetingRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRecordingEvent" ADD CONSTRAINT "MeetingRecordingEvent_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "MeetingRecording"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingTranscriptionJob" ADD CONSTRAINT "MeetingTranscriptionJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingTranscriptionJob" ADD CONSTRAINT "MeetingTranscriptionJob_meetingRoomId_fkey" FOREIGN KEY ("meetingRoomId") REFERENCES "MeetingRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingTranscriptionJob" ADD CONSTRAINT "MeetingTranscriptionJob_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "MeetingRecording"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

