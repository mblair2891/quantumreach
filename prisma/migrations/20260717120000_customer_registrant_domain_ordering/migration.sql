CREATE TYPE "DomainRegistrantType" AS ENUM ('INDIVIDUAL', 'ORGANIZATION');
CREATE TYPE "DomainTransferStatus" AS ENUM ('NOT_REQUESTED', 'REQUESTED', 'IN_REVIEW', 'APPROVED', 'COMPLETED', 'CANCELED');
CREATE TYPE "DomainRegistrarLockStatus" AS ENUM ('UNKNOWN', 'LOCKED', 'UNLOCKED');
CREATE TYPE "DomainAuthCodeStatus" AS ENUM ('NOT_REQUESTED', 'REQUESTED', 'GENERATED', 'DELIVERED', 'EXPIRED');

ALTER TABLE "ManagedDomain" ADD COLUMN "transferEligibleAt" TIMESTAMP(3), ADD COLUMN "transferRequestedAt" TIMESTAMP(3), ADD COLUMN "transferStatus" "DomainTransferStatus" NOT NULL DEFAULT 'NOT_REQUESTED', ADD COLUMN "registrarLockStatus" "DomainRegistrarLockStatus" NOT NULL DEFAULT 'UNKNOWN', ADD COLUMN "authCodeStatus" "DomainAuthCodeStatus" NOT NULL DEFAULT 'NOT_REQUESTED';
ALTER TABLE "DomainPurchaseRequest" ADD COLUMN "ownershipType" "ManagedDomainOwnershipType" NOT NULL DEFAULT 'WORKSPACE_OWNED', ADD COLUMN "registrantAttestationAccepted" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "registrantAttestationText" TEXT;

CREATE TABLE "DomainRegistrantProfile" (
  "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "legalFirstName" TEXT NOT NULL, "legalLastName" TEXT NOT NULL, "organizationName" TEXT, "address1" TEXT NOT NULL, "address2" TEXT, "city" TEXT NOT NULL, "stateProvince" TEXT NOT NULL, "postalCode" TEXT NOT NULL, "countryCode" TEXT NOT NULL, "phone" TEXT NOT NULL, "email" TEXT NOT NULL, "registrantType" "DomainRegistrantType" NOT NULL, "verifiedAt" TIMESTAMP(3), "confirmedAt" TIMESTAMP(3), "confirmedByUserId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DomainRegistrantProfile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DomainRegistrantSnapshot" (
  "id" TEXT NOT NULL, "purchaseRequestId" TEXT NOT NULL, "legalFirstName" TEXT NOT NULL, "legalLastName" TEXT NOT NULL, "organizationName" TEXT, "address1" TEXT NOT NULL, "address2" TEXT, "city" TEXT NOT NULL, "stateProvince" TEXT NOT NULL, "postalCode" TEXT NOT NULL, "countryCode" TEXT NOT NULL, "phone" TEXT NOT NULL, "email" TEXT NOT NULL, "registrantType" "DomainRegistrantType" NOT NULL, "confirmedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DomainRegistrantSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DomainRegistrantProfile_workspaceId_key" ON "DomainRegistrantProfile"("workspaceId");
CREATE INDEX "DomainRegistrantProfile_workspaceId_confirmedAt_idx" ON "DomainRegistrantProfile"("workspaceId", "confirmedAt");
CREATE UNIQUE INDEX "DomainRegistrantSnapshot_purchaseRequestId_key" ON "DomainRegistrantSnapshot"("purchaseRequestId");
CREATE INDEX "DomainPurchaseRequest_ownershipType_status_idx" ON "DomainPurchaseRequest"("ownershipType", "status");
ALTER TABLE "DomainRegistrantProfile" ADD CONSTRAINT "DomainRegistrantProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DomainRegistrantProfile" ADD CONSTRAINT "DomainRegistrantProfile_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DomainRegistrantSnapshot" ADD CONSTRAINT "DomainRegistrantSnapshot_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "DomainPurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
