/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { catalogPrice } from "@/lib/customer-journey/acquisition-draft";

type Db = PrismaClient | Prisma.TransactionClient;
const object = (v: unknown): Record<string, any> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, any> : {};
const entitlementSnapshot = (rows: Array<{ entitlementKey: string; integerValue: number|null; booleanValue: boolean|null; stringValue: string|null }>) => Object.fromEntries(rows.map(e => [e.entitlementKey, e.integerValue ?? e.booleanValue ?? e.stringValue]));
export async function resolveOrCreatePublishedVersion(productId: string, actorId = "SYSTEM", db: Db = prisma) {
  const product = await db.commerceProduct.findFirst({ where: { id: productId, active: true, category: "SENDING_PACKAGE" }, include: { entitlements: true } });
  if (!product) throw new Error("INACTIVE_COMMERCIAL_PLAN");
  const metadata = object(product.metadata), price = catalogPrice(product), entitlements = entitlementSnapshot(product.entitlements);
  const version = Number(metadata.version ?? 1);
  const terms = { planSlug: String(metadata.slug ?? product.key.toLowerCase()), planName: product.name, description: product.description, recurringPriceCents: price.recurringCents, setupPriceCents: price.oneTimeCents, currency: String(metadata.currency ?? "USD"), billingInterval: product.billingInterval, includedDomains: Number(entitlements.MANAGED_DOMAIN_ALLOWANCE ?? 0), includedMailboxes: Number(entitlements.MAILBOX_ALLOWANCE ?? 0), includedContacts: Number(entitlements.ACTIVE_OUTREACH_CONTACT_ALLOWANCE ?? 0), includedTeamUsers: Number(entitlements.TEAM_USER_ALLOWANCE ?? 0), matureMonthlySendAllowance: Number(entitlements.MONTHLY_SEND_ALLOWANCE ?? 0), dailyMailboxAllowance: Number(entitlements.DAILY_MAILBOX_CAPACITY ?? 35), dailyDomainAllowance: Number(entitlements.DAILY_DOMAIN_CAPACITY ?? 105), onboardingLevel: String(metadata.onboarding ?? "Standard"), supportLevel: String(metadata.support ?? "Standard"), entitlementSnapshot: entitlements, customerFacingCopy: { description: product.description, warmupNotice: "Managed sending capacity becomes available after verification and health-based warm-up." }, effectiveDate: String(metadata.effectiveAt ?? new Date(0).toISOString()) };
  return db.commercialCatalogVersion.upsert({ where: { productKey_version: { productKey: product.key, version } }, update: {}, create: { productKey: product.key, version, effectiveAt: new Date(terms.effectiveDate), terms, status: "PUBLISHED", createdById: actorId } });
}
export async function acceptCommercialTerms(input: { orderId: string; productId: string; actorId?: string; addons?: Array<{ key: string; quantity: number }> }, db: Db = prisma) {
  const order = await db.customerOrder.findUniqueOrThrow({ where: { id: input.orderId } });
  if (order.acceptedCommercialTerms && order.commercialCatalogVersionId) return order;
  const version = await resolveOrCreatePublishedVersion(input.productId, input.actorId, db);
  const acceptedAt = new Date();
  const snapshot: Record<string, any> = { ...object(version.terms), catalogVersionId: version.id, catalogVersion: version.version, selectedAddons: input.addons ?? [], acceptedAt: acceptedAt.toISOString() };
  const updated = await db.customerOrder.update({ where: { id: order.id }, data: { commercialCatalogVersionId: version.id, acceptedCommercialTerms: snapshot, commercialTermsAcceptedAt: acceptedAt } });
  if (order.workspaceId) await db.auditLog.create({ data: { workspaceId: order.workspaceId, actorId: input.actorId, action: "COMMERCIAL_TERMS_ACCEPTED", entityType: "CustomerOrder", entityId: order.id, metadata: { catalogVersionId: version.id, planName: snapshot.planName } } });
  return updated;
}
export async function createCatalogDraft(productKey: string, actorId: string, db: Db = prisma) { const latest = await db.commercialCatalogVersion.findFirst({ where: { productKey }, orderBy: { version: "desc" } }); return db.commercialCatalogVersion.create({ data: { productKey, version: (latest?.version ?? 0) + 1, effectiveAt: new Date(), terms: latest?.terms ?? {}, costAssumptions: latest?.costAssumptions ?? {}, status: "DRAFT", createdById: actorId } }); }
export async function updateCatalogDraft(id: string, terms: Prisma.InputJsonValue, effectiveAt: Date, db: Db = prisma) { const row = await db.commercialCatalogVersion.findUniqueOrThrow({ where: { id } }); if (row.status !== "DRAFT") throw new Error("PUBLISHED_CATALOG_VERSION_IMMUTABLE"); return db.commercialCatalogVersion.update({ where: { id }, data: { terms, effectiveAt } }); }
export async function publishCatalogVersion(id: string, _actorId: string, db: Db = prisma) { const row = await db.commercialCatalogVersion.findUniqueOrThrow({ where: { id } }); if (row.status !== "DRAFT") return row; return (db as any).$transaction(async (tx: Prisma.TransactionClient) => { await tx.commercialCatalogVersion.updateMany({ where: { productKey: row.productKey, status: "PUBLISHED", retiredAt: null }, data: { retiredAt: new Date(), status: "RETIRED" } }); const published = await tx.commercialCatalogVersion.update({ where: { id }, data: { status: "PUBLISHED" } }); return published; }); }
