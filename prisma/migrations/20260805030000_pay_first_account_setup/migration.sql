-- Pay-first acquisition: nullable order owner + purchaser fields + setup tokens.

ALTER TABLE "CustomerOrder" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "CustomerOrder" ADD COLUMN "purchaserEmail" TEXT;
ALTER TABLE "CustomerOrder" ADD COLUMN "purchaserFirstName" TEXT;
ALTER TABLE "CustomerOrder" ADD COLUMN "purchaserLastName" TEXT;
ALTER TABLE "CustomerOrder" ADD COLUMN "businessName" TEXT;
ALTER TABLE "CustomerOrder" ADD COLUMN "businessType" TEXT;
ALTER TABLE "CustomerOrder" ADD COLUMN "timezone" TEXT;
ALTER TABLE "CustomerOrder" ADD COLUMN "country" TEXT;
ALTER TABLE "CustomerOrder" ADD COLUMN "intendedUse" TEXT;

CREATE INDEX "CustomerOrder_purchaserEmail_status_idx" ON "CustomerOrder"("purchaserEmail", "status");

CREATE TABLE "AccountSetupToken" (
    "id" TEXT NOT NULL,
    "customerOrderId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountSetupToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountSetupToken_tokenHash_key" ON "AccountSetupToken"("tokenHash");
CREATE INDEX "AccountSetupToken_customerOrderId_idx" ON "AccountSetupToken"("customerOrderId");
CREATE INDEX "AccountSetupToken_email_expiresAt_idx" ON "AccountSetupToken"("email", "expiresAt");

ALTER TABLE "AccountSetupToken" ADD CONSTRAINT "AccountSetupToken_customerOrderId_fkey" FOREIGN KEY ("customerOrderId") REFERENCES "CustomerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
