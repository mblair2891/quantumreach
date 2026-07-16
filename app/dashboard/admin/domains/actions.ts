"use server";

import { revalidatePath } from "next/cache";
import { requireOperatorAccess } from "@/lib/admin/operator";
import { getDomainProvider } from "@/lib/managed-domains/providers";
import { createDomainPurchaseRequest } from "@/lib/managed-domains/purchase";

function domainFrom(formData: FormData) { return String(formData.get("domain") || "").trim().toLowerCase(); }

export async function searchDomainAvailability(_prev: unknown, formData: FormData) {
  await requireOperatorAccess();
  const domain = domainFrom(formData);
  return getDomainProvider().searchDomains(domain);
}

export async function requestDomainQuote(_prev: unknown, formData: FormData) {
  await requireOperatorAccess();
  const domain = domainFrom(formData);
  return getDomainProvider().getDomainQuote(domain);
}

export async function submitHorizonTestRegistration(_prev: unknown, formData: FormData) {
  const operator = await requireOperatorAccess();
  const domain = domainFrom(formData);
  const provider = getDomainProvider();
  const draft = await createDomainPurchaseRequest({ requestedDomain: domain, requestedByUserId: operator.user.id, adminBypass: true });
  const result = await provider.purchaseDomain(domain, draft.id);
  revalidatePath("/dashboard/admin/domains");
  return result;
}
