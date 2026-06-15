CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELED');
CREATE TYPE "MeetingParticipantRole" AS ENUM ('HOST', 'CO_HOST', 'PARTICIPANT', 'GUEST');
CREATE TYPE "MeetingEventType" AS ENUM ('TOKEN_ISSUED', 'PARTICIPANT_JOINED', 'PARTICIPANT_LEFT', 'SCREEN_SHARE_STARTED', 'SCREEN_SHARE_STOPPED', 'ROOM_OPENED', 'ROOM_ENDED');

CREATE TABLE "MeetingRoom" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "callSessionId" TEXT,
  "leadId" TEXT,
  "contactId" TEXT,
  "companyId" TEXT,
  "opportunityId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "slug" TEXT NOT NULL,
  "roomName" TEXT NOT NULL,
  "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
  "scheduledAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingParticipant" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "userId" TEXT,
  "invitationId" TEXT,
  "identity" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "role" "MeetingParticipantRole" NOT NULL,
  "joinedAt" TIMESTAMP(3),
  "leftAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingInvitation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "role" "MeetingParticipantRole" NOT NULL DEFAULT 'GUEST',
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "participantId" TEXT,
  "type" "MeetingEventType" NOT NULL,
  "eventKey" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MeetingRoom_callSessionId_key" ON "MeetingRoom"("callSessionId");
CREATE UNIQUE INDEX "MeetingRoom_slug_key" ON "MeetingRoom"("slug");
CREATE UNIQUE INDEX "MeetingRoom_roomName_key" ON "MeetingRoom"("roomName");
CREATE INDEX "MeetingRoom_workspaceId_status_scheduledAt_idx" ON "MeetingRoom"("workspaceId", "status", "scheduledAt");
CREATE INDEX "MeetingRoom_workspaceId_hostId_idx" ON "MeetingRoom"("workspaceId", "hostId");
CREATE INDEX "MeetingRoom_workspaceId_callSessionId_idx" ON "MeetingRoom"("workspaceId", "callSessionId");
CREATE UNIQUE INDEX "MeetingParticipant_meetingId_identity_key" ON "MeetingParticipant"("meetingId", "identity");
CREATE INDEX "MeetingParticipant_workspaceId_meetingId_idx" ON "MeetingParticipant"("workspaceId", "meetingId");
CREATE INDEX "MeetingParticipant_meetingId_userId_idx" ON "MeetingParticipant"("meetingId", "userId");
CREATE INDEX "MeetingParticipant_meetingId_invitationId_idx" ON "MeetingParticipant"("meetingId", "invitationId");
CREATE UNIQUE INDEX "MeetingInvitation_tokenHash_key" ON "MeetingInvitation"("tokenHash");
CREATE INDEX "MeetingInvitation_workspaceId_meetingId_idx" ON "MeetingInvitation"("workspaceId", "meetingId");
CREATE INDEX "MeetingInvitation_meetingId_revokedAt_expiresAt_idx" ON "MeetingInvitation"("meetingId", "revokedAt", "expiresAt");
CREATE UNIQUE INDEX "MeetingEvent_eventKey_key" ON "MeetingEvent"("eventKey");
CREATE INDEX "MeetingEvent_workspaceId_meetingId_occurredAt_idx" ON "MeetingEvent"("workspaceId", "meetingId", "occurredAt");
CREATE INDEX "MeetingEvent_meetingId_type_idx" ON "MeetingEvent"("meetingId", "type");

ALTER TABLE "MeetingRoom" ADD CONSTRAINT "MeetingRoom_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingRoom" ADD CONSTRAINT "MeetingRoom_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeetingRoom" ADD CONSTRAINT "MeetingRoom_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "CallSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingRoom" ADD CONSTRAINT "MeetingRoom_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingRoom" ADD CONSTRAINT "MeetingRoom_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingRoom" ADD CONSTRAINT "MeetingRoom_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingRoom" ADD CONSTRAINT "MeetingRoom_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "MeetingRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "MeetingInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingInvitation" ADD CONSTRAINT "MeetingInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingInvitation" ADD CONSTRAINT "MeetingInvitation_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "MeetingRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingEvent" ADD CONSTRAINT "MeetingEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingEvent" ADD CONSTRAINT "MeetingEvent_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "MeetingRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingEvent" ADD CONSTRAINT "MeetingEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "MeetingParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
