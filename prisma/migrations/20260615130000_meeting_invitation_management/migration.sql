ALTER TABLE "MeetingInvitation" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "MeetingInvitation" ADD COLUMN "displayName" TEXT;
ALTER TABLE "MeetingInvitation" ADD COLUMN "email" TEXT;
ALTER TABLE "MeetingInvitation" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "MeetingInvitation" ADD COLUMN "lastCopiedAt" TIMESTAMP(3);
