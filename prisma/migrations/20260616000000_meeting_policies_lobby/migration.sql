-- Non-destructive meeting policy and waiting lobby expansion.
CREATE TYPE "MeetingLobbyStatus" AS ENUM ('WAITING', 'ADMITTED', 'DENIED', 'CANCELLED', 'EXPIRED');
ALTER TYPE "MeetingEventType" ADD VALUE IF NOT EXISTS 'LOBBY_JOIN_REQUESTED';
ALTER TYPE "MeetingEventType" ADD VALUE IF NOT EXISTS 'PARTICIPANT_ADMITTED';
ALTER TYPE "MeetingEventType" ADD VALUE IF NOT EXISTS 'PARTICIPANT_DENIED';
ALTER TYPE "MeetingEventType" ADD VALUE IF NOT EXISTS 'PARTICIPANT_LEFT_LOBBY';
ALTER TYPE "MeetingEventType" ADD VALUE IF NOT EXISTS 'RECORDING_CONSENT_PREPARED';
ALTER TYPE "MeetingRecordingEventType" ADD VALUE IF NOT EXISTS 'RECORDING_CONSENT_PREPARED';
ALTER TABLE "MeetingRoom" ADD COLUMN "recordingPlanned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MeetingRoom" ADD COLUMN "recordingConsentRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MeetingRoom" ADD COLUMN "lobbyEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MeetingRoom" ADD COLUMN "recordingConsentPreparedAt" TIMESTAMP(3);
ALTER TABLE "MeetingRoom" ADD COLUMN "lobbyPolicyUpdatedAt" TIMESTAMP(3);
CREATE TABLE "MeetingLobbyEntry" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "meetingRoomId" TEXT NOT NULL,
  "invitationId" TEXT,
  "userId" TEXT,
  "livekitIdentity" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "email" TEXT,
  "role" "MeetingParticipantRole" NOT NULL,
  "status" "MeetingLobbyStatus" NOT NULL DEFAULT 'WAITING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "admittedAt" TIMESTAMP(3),
  "admittedById" TEXT,
  "deniedAt" TIMESTAMP(3),
  "deniedById" TEXT,
  "leftAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingLobbyEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MeetingLobbyEntry_meetingRoomId_livekitIdentity_key" ON "MeetingLobbyEntry"("meetingRoomId", "livekitIdentity");
CREATE INDEX "MeetingLobbyEntry_workspaceId_meetingRoomId_status_idx" ON "MeetingLobbyEntry"("workspaceId", "meetingRoomId", "status");
CREATE INDEX "MeetingLobbyEntry_meetingRoomId_invitationId_idx" ON "MeetingLobbyEntry"("meetingRoomId", "invitationId");
CREATE INDEX "MeetingLobbyEntry_meetingRoomId_userId_idx" ON "MeetingLobbyEntry"("meetingRoomId", "userId");
ALTER TABLE "MeetingLobbyEntry" ADD CONSTRAINT "MeetingLobbyEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingLobbyEntry" ADD CONSTRAINT "MeetingLobbyEntry_meetingRoomId_fkey" FOREIGN KEY ("meetingRoomId") REFERENCES "MeetingRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingLobbyEntry" ADD CONSTRAINT "MeetingLobbyEntry_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "MeetingInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingLobbyEntry" ADD CONSTRAINT "MeetingLobbyEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingLobbyEntry" ADD CONSTRAINT "MeetingLobbyEntry_admittedById_fkey" FOREIGN KEY ("admittedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
