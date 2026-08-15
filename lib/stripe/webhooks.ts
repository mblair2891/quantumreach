/* eslint-disable @typescript-eslint/no-explicit-any -- Stripe event objects have provider-specific shapes. */
import { prisma } from "@/lib/db/prisma";
import { verifyStripePayment } from "@/lib/customer-journey/service";
import type Stripe from "stripe";
import { resolveStripePrice } from "./prices";
import { reconcileAffiliateMembershipForSubscriptionStatus } from "@/lib/affiliates/service";

type StripeStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INCOMPLETE";
type StripeEvent = Pick<Stripe.Event, "id" | "type"> & { data: { object: Record<string, any> } };
const stripeId = (value: unknown) => typeof value === "string" ? value : typeof value === "object" && value && "id" in value ? String((value as any).id) : undefined;
const subscriptionStatus = (value: string | undefined): StripeStatus => value === "trialing" ? "TRIALING" : value === "past_due" ? "PAST_DUE" : value === "unpaid" ? "UNPAID" : value === "incomplete" ? "INCOMPLETE" : value === "canceled" ? "CANCELED" : "ACTIVE";

async function findOrder(object: Record<string, any>) {
  const orderId = object.metadata?.quantumReachOrderId ?? object.metadata?.customerOrderId;
  if (orderId) return prisma.customerOrder.findUnique({ where: { id: String(orderId) } });
  const paymentIntentId = stripeId(object.payment_intent);
  const subscriptionId = stripeId(object.subscription) || stripeId(object);
  return prisma.customerOrder.findFirst({ where: { OR: [{ stripePaymentIntentId: paymentIntentId }, { stripeCheckoutSessionId: object.id }, { stripeSubscriptionId: subscriptionId }] } });
}

async function createCommission(order: any, paymentIntentId: string | undefined, gross: number) {
  if (!order.affiliateAttributionId || !paymentIntentId) return;
  const attribution = await prisma.affiliateAttribution.findUnique({ where: { id: order.affiliateAttributionId } });
  if (!attribution) return;
  const affiliate = await prisma.affiliateAccount.findUnique({ where: { id: attribution.affiliateAccountId } });
  if (!affiliate || affiliate.status !== "ACTIVE" || affiliate.subscriberUserId === order.userId) return;
  const existing = await prisma.affiliateCommission.findFirst({ where: { paymentIntentId } });
  if (!existing) await prisma.affiliateCommission.create({ data: { affiliateAccountId: affiliate.id, referredCustomerUserId: order.userId, paymentIntentId, grossCents: gross, commissionRateBps: affiliate.commissionRateBps, commissionCents: Math.floor(gross * affiliate.commissionRateBps / 10_000), status: "PENDING" } });
}

async function syncPaid(object: Record<string, any>, eventId: string) {
  const order = await findOrder(object); if (!order) return;
  const paymentIntentId = stripeId(object.payment_intent) || stripeId(object.id);
  const subscriptionId = stripeId(object.subscription); const amount = Number(object.amount_total ?? object.amount_paid ?? 0);
  await prisma.$transaction(async tx => {
    if (paymentIntentId) await tx.stripePaymentRecord.upsert({ where: { stripePaymentIntentId: paymentIntentId }, create: { customerOrderId: order.id, stripePaymentIntentId: paymentIntentId, stripeSubscriptionId: subscriptionId, amountCents: amount, currency: object.currency, status: "SUCCEEDED", paidAt: new Date() }, update: { status: "SUCCEEDED", amountCents: amount, paidAt: new Date() } });
  });
  await createCommission(order, paymentIntentId, amount);
  // Shared fulfillment is the only authority for workspaces, entitlements, queue state, and notifications.
  await verifyStripePayment(order.id, eventId, paymentIntentId, subscriptionId);
}

async function syncSubscription(object: Record<string, any>, eventId: string) {
  const providerSubscriptionId = stripeId(object); if (!providerSubscriptionId) return;
  const order = await findOrder(object);
  if (!order) throw new Error("Stripe subscription cannot yet be correlated to a customer order.");
  // Guest pay-first: store the provider id and wait for account claim + workspace fulfillment.
  if (!order.workspaceId || !order.userId) {
    if (order.stripeSubscriptionId !== providerSubscriptionId) {
      await prisma.customerOrder.update({ where: { id: order.id }, data: { stripeSubscriptionId: providerSubscriptionId } });
    }
    return;
  }
  const status = subscriptionStatus(object.status); const periodEnd = object.current_period_end ? new Date(Number(object.current_period_end) * 1000) : undefined;
  const subscription = await prisma.saasSubscription.upsert({ where: { stripeSubscriptionId: providerSubscriptionId }, create: { userId: order.userId, workspaceId: order.workspaceId, stripeCustomerId: order.stripeCustomerId, stripeSubscriptionId: providerSubscriptionId, status, currentPeriodEnd: periodEnd, affiliateAttributionId: order.affiliateAttributionId, commissionEligible: Boolean(order.affiliateAttributionId) }, update: { status, currentPeriodEnd: periodEnd, workspaceId: order.workspaceId, stripeCustomerId: order.stripeCustomerId } });
  const subscriber = await prisma.userProfile.findUniqueOrThrow({ where: { id: order.userId } });
  await reconcileAffiliateMembershipForSubscriptionStatus({ userId: subscriber.id, email: subscriber.email, displayName: [subscriber.firstName, subscriber.lastName].filter(Boolean).join(" ") || subscriber.email, subscriptionId: subscription.id, correlationId: eventId, status });
  const priceIds = new Map<string, Record<string, any>>((object.items?.data ?? []).filter((item: any) => typeof item.price?.id === "string").map((item: any) => [item.price.id as string, item]));
  const catalog = await prisma.commerceProduct.findMany({ where: { active: true } });
  const products = catalog.map((product) => { try { return { ...product, stripePriceId: resolveStripePrice(product.key) }; } catch { return null; } }).filter((product): product is NonNullable<typeof product> => Boolean(product?.stripePriceId && priceIds.has(product.stripePriceId)));
  for (const product of products) {
    if (!product.stripePriceId) continue; const item = priceIds.get(product.stripePriceId); if (!item?.id) continue;
    await prisma.saasSubscriptionItem.upsert({ where: { stripeSubscriptionItemId: item.id }, create: { workspaceId: order.workspaceId, saasSubscriptionId: subscription.id, commerceProductId: product.id, stripeSubscriptionItemId: item.id, quantity: Math.max(1, Number(item.quantity ?? 1)), status, source: "STRIPE", currentPeriodStart: object.current_period_start ? new Date(Number(object.current_period_start) * 1000) : undefined, currentPeriodEnd: periodEnd }, update: { saasSubscriptionId: subscription.id, quantity: Math.max(1, Number(item.quantity ?? 1)), status, currentPeriodEnd: periodEnd } });
  }
}

async function syncRefund(object: Record<string, any>) {
  const intent = stripeId(object.payment_intent); const payment = intent ? await prisma.stripePaymentRecord.findUnique({ where: { stripePaymentIntentId: intent } }) : null;
  await prisma.stripeRefundRecord.upsert({ where: { stripeRefundId: object.id }, create: { stripeRefundId: object.id, customerOrderId: payment?.customerOrderId, stripePaymentIntentId: intent, amountCents: Number(object.amount || 0), status: object.status || "created" }, update: { status: object.status || "created" } });
  if (!payment?.customerOrderId) return;
  const amount = Number(object.amount || 0); const order = await prisma.customerOrder.update({ where: { id: payment.customerOrderId }, data: { refundedAmountCents: { increment: amount } } });
  await prisma.customerOrder.update({ where: { id: order.id }, data: { paymentStatus: order.refundedAmountCents + amount >= (payment.amountCents || Infinity) ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
  await prisma.affiliateCommission.updateMany({ where: { paymentIntentId: intent, status: { not: "PAID" } }, data: { status: "REVERSED" } });
}

async function syncDispute(object: Record<string, any>) {
  const intent = stripeId(object.payment_intent); const payment = intent ? await prisma.stripePaymentRecord.findUnique({ where: { stripePaymentIntentId: intent } }) : null;
  await prisma.stripeDisputeRecord.upsert({ where: { stripeDisputeId: object.id }, create: { stripeDisputeId: object.id, customerOrderId: payment?.customerOrderId, stripePaymentIntentId: intent, amountCents: object.amount, status: object.status, reason: object.reason }, update: { status: object.status, reason: object.reason } });
  if (payment?.customerOrderId) { await prisma.customerOrder.update({ where: { id: payment.customerOrderId }, data: { paymentStatus: "DISPUTED", disputedAt: new Date() } }); await prisma.affiliateCommission.updateMany({ where: { paymentIntentId: intent, status: { not: "PAID" } }, data: { status: "REVERSED" } }); }
}

export async function processStripeEvent(event: StripeEvent) {
  const object = event.data.object;
  const existing = await prisma.stripeWebhookEvent.findUnique({ where: { stripeEventId: event.id } });
  if (existing?.status === "PROCESSED") return;
  const record = existing ? await prisma.stripeWebhookEvent.update({ where: { id: existing.id }, data: { status: "PROCESSING", retryCount: { increment: existing.status === "FAILED" ? 1 : 0 }, safeError: null } }) : await prisma.stripeWebhookEvent.create({ data: { stripeEventId: event.id, eventType: event.type, status: "PROCESSING" } });
  try {
    if ((event.type === "checkout.session.completed" && object.payment_status === "paid") || event.type === "checkout.session.async_payment_succeeded") await syncPaid(object, event.id);
    if (["checkout.session.async_payment_failed", "payment_intent.payment_failed"].includes(event.type)) { const order=await findOrder(object); if(order && order.paymentStatus!=="PAID") await prisma.customerOrder.update({where:{id:order.id},data:{paymentStatus:"FAILED",status:"FAILED"}}); }
    if (["refund.created", "refund.updated", "charge.refunded"].includes(event.type)) await syncRefund(object);
    if (event.type.startsWith("charge.dispute.")) await syncDispute(object);
    if (event.type.startsWith("customer.subscription.")) await syncSubscription(object, event.id);
    const order=await findOrder(object); await prisma.stripeWebhookEvent.update({ where: { id: record.id }, data: { status: "PROCESSED", processedAt: new Date(), safeError: null, customerOrderId: order?.id } });
  } catch (error) {
    await prisma.stripeWebhookEvent.update({ where: { id: record.id }, data: { status: "FAILED", safeError: error instanceof Error ? error.message.slice(0, 500) : "Webhook processing failed" } });
    throw error;
  }
}
