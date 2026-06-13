-- Phase 9A Native Meetings: non-destructive additions only.
CREATE TYPE "MeetingRoomStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'OPEN', 'IN_PROGRESS', 'ENDED', 'CANCELLED', 'ARCHIVED');
CREATE TYPE "MeetingParticipantRole" AS ENUM ('HOST', 'CO_HOST', 'PARTICIPANT', 'GUEST');
CREATE TYPE "MeetingEventType" AS ENUM ('ROOM_CREATED', 'ROOM_OPENED', 'PARTICIPANT_JOINED', 'PARTICIPANT_LEFT', 'SCREEN_SHARE_STARTED', 'SCREEN_SHARE_STOPPED', 'ROOM_ENDED', 'TOKEN_ISSUED', 'INVITATION_CREATED', 'INVITATION_REVOKED');
ALTER TYPE "CallProvider" ADD VALUE IF NOT EXISTS 'QUANTUM_REACH_MEETINGS';

CREATE TABLE "MeetingRoom" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "roomName" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" "MeetingRoomStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduledAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "hostUserId" TEXT,
  "leadId" TEXT,
  "contactId" TEXT,
  "companyId" TEXT,
  "opportunityId" TEXT,
  "callSessionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingParticipant" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "meetingRoomId" TEXT NOT NULL,
  "userId" TEXT,
  "guestName" TEXT,
  "guestEmail" TEXT,
  "livekitIdentity" TEXT NOT NULL,
  "role" "MeetingParticipantRole" NOT NULL DEFAULT 'PARTICIPANT',
  "joinedAt" TIMESTAMP(3),
  "leftAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingInvitation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "meetingRoomId" TEXT NOT NULL,
  "email" TEXT,
  "displayName" TEXT,
  "tokenHash" TEXT NOT NULL,
  "role" "MeetingParticipantRole" NOT NULL DEFAULT 'GUEST',
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "meetingRoomId" TEXT NOT NULL,
  "participantId" TEXT,
  "type" "MeetingEventType" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MeetingRoom_roomName_key" ON "MeetingRoom"("roomName");
CREATE UNIQUE INDEX "MeetingRoom_slug_key" ON "MeetingRoom"("slug");
CREATE INDEX "MeetingRoom_workspaceId_status_idx" ON "MeetingRoom"("workspaceId", "status");
CREATE INDEX "MeetingRoom_workspaceId_slug_idx" ON "MeetingRoom"("workspaceId", "slug");
CREATE INDEX "MeetingRoom_workspaceId_callSessionId_idx" ON "MeetingRoom"("workspaceId", "callSessionId");
CREATE UNIQUE INDEX "MeetingParticipant_meetingRoomId_livekitIdentity_key" ON "MeetingParticipant"("meetingRoomId", "livekitIdentity");
CREATE INDEX "MeetingParticipant_workspaceId_meetingRoomId_idx" ON "MeetingParticipant"("workspaceId", "meetingRoomId");
CREATE INDEX "MeetingParticipant_userId_idx" ON "MeetingParticipant"("userId");
CREATE UNIQUE INDEX "MeetingInvitation_tokenHash_key" ON "MeetingInvitation"("tokenHash");
CREATE INDEX "MeetingInvitation_workspaceId_meetingRoomId_idx" ON "MeetingInvitation"("workspaceId", "meetingRoomId");
CREATE INDEX "MeetingEvent_workspaceId_meetingRoomId_createdAt_idx" ON "MeetingEvent"("workspaceId", "meetingRoomId", "createdAt");

ALTER TABLE "MeetingRoom" ADD CONSTRAINT "MeetingRoom_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingRoom" ADD CONSTRAINT "MeetingRoom_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingRoom" ADD CONSTRAINT "MeetingRoom_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingRoom" ADD CONSTRAINT "MeetingRoom_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingRoom" ADD CONSTRAINT "MeetingRoom_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingRoom" ADD CONSTRAINT "MeetingRoom_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingRoom" ADD CONSTRAINT "MeetingRoom_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingRoom" ADD CONSTRAINT "MeetingRoom_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "CallSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_meetingRoomId_fkey" FOREIGN KEY ("meetingRoomId") REFERENCES "MeetingRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingInvitation" ADD CONSTRAINT "MeetingInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingInvitation" ADD CONSTRAINT "MeetingInvitation_meetingRoomId_fkey" FOREIGN KEY ("meetingRoomId") REFERENCES "MeetingRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingEvent" ADD CONSTRAINT "MeetingEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingEvent" ADD CONSTRAINT "MeetingEvent_meetingRoomId_fkey" FOREIGN KEY ("meetingRoomId") REFERENCES "MeetingRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingEvent" ADD CONSTRAINT "MeetingEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "MeetingParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
