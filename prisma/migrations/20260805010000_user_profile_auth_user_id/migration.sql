-- Link app UserProfile to Better Auth user; Clerk subject becomes optional.

ALTER TABLE "UserProfile" ALTER COLUMN "clerkUserId" DROP NOT NULL;

ALTER TABLE "UserProfile" ADD COLUMN "authUserId" TEXT;

CREATE UNIQUE INDEX "UserProfile_authUserId_key" ON "UserProfile"("authUserId");
