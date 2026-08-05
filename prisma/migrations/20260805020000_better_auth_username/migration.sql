-- Better Auth username plugin fields on auth user table.

ALTER TABLE "user" ADD COLUMN "username" TEXT;
ALTER TABLE "user" ADD COLUMN "displayUsername" TEXT;

CREATE UNIQUE INDEX "user_username_key" ON "user"("username");
