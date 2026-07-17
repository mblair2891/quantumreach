/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
import { getDomainProvider } from "./providers";
import {
  toRegistrantSnapshot,
  validateRegistrantContact,
  type OwnershipType,
} from "./registrant";
export async function upsertDomainRegistrantProfile(input: any) {
  const normalizedInput = {
    ...input,
    countryCode: input.countryCode?.toUpperCase(),
    email: input.email?.toLowerCase(),
  };
  const valid = validateRegistrantContact(normalizedInput);
  if (!valid.complete)
    throw new Error(
      `Registrant profile is incomplete: ${valid.missing.join(", ")}.`,
    );
  return (prisma as any).domainRegistrantProfile.upsert({
    where: { workspaceId: input.workspaceId },
    create: {
      ...input,
      email: input.email.toLowerCase(),
      countryCode: input.countryCode.toUpperCase(),
    },
    update: {
      ...input,
      email: input.email.toLowerCase(),
      countryCode: input.countryCode.toUpperCase(),
    },
  });
}
export async function confirmDomainRegistrantProfile(
  workspaceId: string,
  confirmedByUserId: string,
) {
  return (prisma as any).domainRegistrantProfile.update({
    where: { workspaceId },
    data: { confirmedAt: new Date(), confirmedByUserId },
  });
}
export async function getDomainRegistrantProfile(workspaceId: string) {
  return (prisma as any).domainRegistrantProfile.findUnique({
    where: { workspaceId },
  });
}
export async function createDomainPurchaseRequest(input: {
  requestedDomain: string;
  workspaceId?: string;
  requestedByUserId?: string;
  adminBypass?: boolean;
  ownershipType?: OwnershipType;
  registrantAttestationAccepted?: boolean;
}) {
  const ownershipType = input.ownershipType || "WORKSPACE_OWNED";
  const provider = getDomainProvider();
  const quote = await provider.getDomainQuote(input.requestedDomain);
  let snapshot: any;
  if (ownershipType === "WORKSPACE_OWNED") {
    if (!input.workspaceId)
      throw new Error("Workspace-owned purchases require a workspace.");
    const profile = await (prisma as any).domainRegistrantProfile.findUnique({
      where: { workspaceId: input.workspaceId },
    });
    const valid = validateRegistrantContact(profile);
    if (!valid.complete)
      throw new Error(
        `Registrant profile is incomplete: ${valid.missing.join(", ")}.`,
      );
    if (!profile.confirmedAt || !input.registrantAttestationAccepted)
      throw new Error(
        "Registrant accuracy and authorization attestation is required before purchase.",
      );
    snapshot = toRegistrantSnapshot(profile);
  }
  return (prisma as any).domainPurchaseRequest.create({
    data: {
      workspaceId: input.workspaceId,
      requestedByUserId: input.requestedByUserId,
      requestedDomain: input.requestedDomain.toLowerCase(),
      ownershipType,
      registrantAttestationAccepted: !!input.registrantAttestationAccepted,
      registrantAttestationText: input.registrantAttestationAccepted
        ? "registrant accurate; authorized Quantum Reach registrar management; reseller/service-provider acknowledged"
        : null,
      status: quote.ok ? "QUOTED" : "DRAFT",
      estimatedCostCents: quote.data?.estimatedCostCents,
      resalePriceCents: quote.data?.resalePriceCents,
      providerQuoteId: quote.data?.providerQuoteId,
      safeError: quote.safeError,
      registrantSnapshot: snapshot ? { create: snapshot } : undefined,
    },
  });
}
export async function approveDomainPurchaseRequest(
  id: string,
  approvedByUserId: string,
) {
  return (prisma as any).domainPurchaseRequest.update({
    where: { id },
    data: { status: "APPROVED", approvedByUserId },
  });
}
export async function purchaseApprovedDomain(id: string) {
  const request = await (prisma as any).domainPurchaseRequest.findUnique({
    where: { id },
    include: { registrantSnapshot: true },
  });
  if (!request || request.status !== "APPROVED")
    throw new Error("Purchase request must be approved before purchasing.");
  if (
    request.ownershipType === "WORKSPACE_OWNED" &&
    !request.registrantSnapshot
  )
    throw new Error(
      "Workspace-owned purchase requires an immutable registrant snapshot.",
    );
  const result = await getDomainProvider().purchaseDomain(
    request.requestedDomain,
    id,
    request as any,
  );
  if (!result.ok)
    return (prisma as any).domainPurchaseRequest.update({
      where: { id },
      data: { status: "FAILED", safeError: result.safeError },
    });
  return (prisma as any).domainPurchaseRequest.update({
    where: { id },
    data: { status: "PURCHASED", purchasedAt: new Date() },
  });
}
