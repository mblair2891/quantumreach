/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
import { getDomainProvider } from "./providers";
export async function createDomainPurchaseRequest(input: { requestedDomain: string; workspaceId?: string; requestedByUserId?: string; adminBypass?: boolean }) {
  const provider = getDomainProvider();
  const quote = await provider.getDomainQuote(input.requestedDomain);
  return (prisma as any).domainPurchaseRequest.create({ data: { workspaceId: input.workspaceId, requestedByUserId: input.requestedByUserId, requestedDomain: input.requestedDomain.toLowerCase(), status: quote.ok ? "QUOTED" : "DRAFT", estimatedCostCents: quote.data?.estimatedCostCents, resalePriceCents: quote.data?.resalePriceCents, providerQuoteId: quote.data?.providerQuoteId, safeError: quote.safeError } });
}
export async function approveDomainPurchaseRequest(id: string, approvedByUserId: string) { return (prisma as any).domainPurchaseRequest.update({ where: { id }, data: { status: "APPROVED", approvedByUserId } }); }
export async function purchaseApprovedDomain(id: string) { const request = await (prisma as any).domainPurchaseRequest.findUnique({ where: { id } }); if (!request || request.status !== "APPROVED") throw new Error("Purchase request must be approved before purchasing."); const result = await getDomainProvider().purchaseDomain(request.requestedDomain, id); if (!result.ok) return (prisma as any).domainPurchaseRequest.update({ where: { id }, data: { status: "FAILED", safeError: result.safeError } }); return (prisma as any).domainPurchaseRequest.update({ where: { id }, data: { status: "PURCHASED", purchasedAt: new Date() } }); }
