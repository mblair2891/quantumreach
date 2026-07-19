/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";

export type ManualSource = "MANUAL_OPERATOR" | "COMPLIMENTARY" | "MIGRATION" | "SYSTEM";
type Db = typeof prisma;
const active = ["ACTIVE", "TRIALING"] as const;
const coreKey = "QUANTUM_REACH_CORE";
function isActive(item: { status: string; quantity: number; startsAt: Date | null; endsAt: Date | null; commerceProduct: { active: boolean } }, now = new Date()) {
  return item.commerceProduct.active && active.includes(item.status as typeof active[number]) && item.quantity > 0 && (!item.startsAt || item.startsAt <= now) && (!item.endsAt || item.endsAt > now);
}
async function validateComposition(db: Db, workspaceId: string, product: { id: string; key: string; category: string }, startsAt?: Date | null) {
  if (product.key === coreKey) return;
  const items = await db.saasSubscriptionItem.findMany({ where: { workspaceId }, include: { commerceProduct: true } });
  const hasCore = items.some((item) => item.commerceProduct.key === coreKey && isActive(item));
  if (!hasCore) throw new Error("Core subscription required before assigning this product.");
  if (product.category === "SENDING_PACKAGE") {
    const existing = items.some((item) => item.commerceProduct.category === "SENDING_PACKAGE" && item.commerceProductId !== product.id && isActive(item));
    if (existing) throw new Error("Another sending package is already active. Deactivate it before assigning a replacement.");
  }
  if (startsAt && startsAt > new Date()) return; // a future item remains validated at activation by operator review.
}
export async function assignWorkspaceCommerceProduct(input: { workspaceId: string; productId: string; quantity: number; source: ManualSource; assignedById?: string | null; startsAt?: Date | null; endsAt?: Date | null; note?: string | null }, db: Db = prisma) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new Error("Quantity must be a positive integer.");
  if (input.endsAt && input.startsAt && input.endsAt <= input.startsAt) throw new Error("End date must be after start date.");
  return db.$transaction(async (tx) => {
    const [workspace, product] = await Promise.all([tx.workspace.findUnique({ where: { id: input.workspaceId } }), tx.commerceProduct.findUnique({ where: { id: input.productId } })]);
    if (!workspace) throw new Error("Workspace not found.");
    if (!product || !product.active) throw new Error("Product is inactive or unavailable.");
    await validateComposition(tx as Db, workspace.id, product, input.startsAt);
    const previous = await tx.saasSubscriptionItem.findFirst({ where: { workspaceId: workspace.id, commerceProductId: product.id, source: input.source as any, stripeSubscriptionItemId: null, status: { in: active as any } }, orderBy: { createdAt: "desc" } });
    const item = previous ? await tx.saasSubscriptionItem.update({ where: { id: previous.id }, data: { quantity: { increment: input.quantity }, startsAt: input.startsAt ?? previous.startsAt, endsAt: input.endsAt ?? previous.endsAt, note: input.note ?? previous.note } }) : await tx.saasSubscriptionItem.create({ data: { workspaceId: workspace.id, commerceProductId: product.id, quantity: input.quantity, source: input.source as any, assignedById: input.assignedById, startsAt: input.startsAt, endsAt: input.endsAt, note: input.note, status: "ACTIVE" } });
    await tx.auditLog.create({ data: { workspaceId: workspace.id, actorId: input.assignedById, action: input.source === "COMPLIMENTARY" ? "COMPLIMENTARY_PRODUCT_GRANTED" : "COMMERCE_PRODUCT_ASSIGNED", entityType: "SaasSubscriptionItem", entityId: item.id, metadata: { productKey: product.key, quantity: input.quantity, source: input.source } } });
    return item;
  });
}
export async function updateManualWorkspaceCommerceItem(input: { itemId: string; quantity?: number; startsAt?: Date | null; endsAt?: Date | null; note?: string | null; actorId?: string | null }, db: Db = prisma) {
  const item = await db.saasSubscriptionItem.findUnique({ where: { id: input.itemId } }); if (!item) throw new Error("Subscription item not found."); if (item.source === "STRIPE" || item.stripeSubscriptionItemId) throw new Error("This item is managed by Stripe and cannot be edited manually.");
  if (input.quantity !== undefined && (!Number.isInteger(input.quantity) || input.quantity <= 0)) throw new Error("Quantity must be a positive integer.");
  return db.$transaction(async tx => { const updated = await tx.saasSubscriptionItem.update({ where: { id: item.id }, data: { quantity: input.quantity, startsAt: input.startsAt, endsAt: input.endsAt, note: input.note } }); await tx.auditLog.create({ data: { workspaceId: item.workspaceId, actorId: input.actorId, action: "COMMERCE_PRODUCT_UPDATED", entityType: "SaasSubscriptionItem", entityId: item.id, metadata: { quantity: input.quantity } } }); return updated; });
}
export async function deactivateManualWorkspaceCommerceItem(itemId: string, actorId?: string | null, db: Db = prisma) { const item = await db.saasSubscriptionItem.findUnique({ where: { id: itemId } }); if (!item) throw new Error("Subscription item not found."); if (item.source === "STRIPE" || item.stripeSubscriptionItemId) throw new Error("This item is managed by Stripe and cannot be edited manually."); return db.$transaction(async tx => { const updated = await tx.saasSubscriptionItem.update({ where: { id: itemId }, data: { status: "CANCELED", endsAt: new Date() } }); await tx.auditLog.create({ data: { workspaceId: item.workspaceId, actorId, action: "COMMERCE_PRODUCT_DEACTIVATED", entityType: "SaasSubscriptionItem", entityId: itemId, metadata: { source: item.source } } }); return updated; }); }
