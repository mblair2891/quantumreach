/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
import Stripe from "stripe";
import { getStripeClient } from "./client";
import { resolveStripePrice } from "./prices";
import { verifyStripePayment } from "@/lib/customer-journey/service";

type Product = { id: string; key: string; recurring: boolean; active: boolean };
const omittedStripeProductKeys = new Set(["STANDARD_SETUP"]);

export type CheckoutActor = {
  id?: string | null;
  email?: string | null;
  acquisitionSessionId?: string | null;
};

const stripeObjectId = (value: unknown) =>
  typeof value === "string" ? value : typeof value === "object" && value && "id" in value ? String((value as { id: unknown }).id) : undefined;

const productKey = (item: { itemType: string; metadata: unknown }, priority: string) => {
  const metadata = item.metadata as Record<string, unknown>;
  const fromMetadata = typeof metadata?.productKey === "string" ? metadata.productKey : undefined;
  const fromPriority = item.itemType === "SETUP_PRIORITY" ? (priority === "PRIORITY" ? "PRIORITY_SETUP" : undefined) : undefined;
  const key = fromMetadata ?? fromPriority;
  if (!key || omittedStripeProductKeys.has(key)) return undefined;
  return key;
};

export function assertCheckoutAccess(
  order: { userId: string | null; purchaserEmail: string | null; acquisitionSessionId: string | null },
  actor: CheckoutActor,
) {
  if (order.userId) {
    if (!actor.id || actor.id !== order.userId) throw new Error("Order ownership validation failed.");
    return;
  }
  const sessionOk = Boolean(actor.acquisitionSessionId && order.acquisitionSessionId && actor.acquisitionSessionId === order.acquisitionSessionId);
  const actorEmail = actor.email?.trim().toLowerCase();
  const purchaserEmail = order.purchaserEmail?.trim().toLowerCase();
  const emailOk = Boolean(actorEmail && purchaserEmail && actorEmail === purchaserEmail);
  if (!sessionOk && !emailOk) throw new Error("Order ownership validation failed.");
}

export async function checkoutProducts(orderId: string) {
  const order = await prisma.customerOrder.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  if (!["CHECKOUT_PENDING", "DRAFT", "FAILED"].includes(order.status) || order.paymentStatus === "PAID") throw new Error("This order is not eligible for checkout.");
  if (order.setupPriority === "EXPEDITED") throw new Error("The selected setup priority is no longer available.");
  const setupKey = order.setupPriority === "PRIORITY" ? "PRIORITY_SETUP" : undefined;
  const keys = [...new Set(["QUANTUM_REACH_CORE", ...order.items.map((item) => productKey(item, order.setupPriority)).filter((key): key is string => Boolean(key)), setupKey].filter((key): key is string => Boolean(key)))];
  const products = await prisma.commerceProduct.findMany({ where: { key: { in: [...new Set(keys)] }, active: true } });
  const byKey = new Map(products.map((product) => [product.key, product]));
  return { order, products: keys.map((key) => { const product = byKey.get(key); if (!product) throw new Error(`Unsupported or inactive commerce product: ${key}.`); return { ...product, stripePriceId: resolveStripePrice(key) } as Product & { stripePriceId: string }; }) };
}

export async function getOrCreateStripeCustomer(userId: string, email: string) {
  const link = await prisma.stripeCustomerLink.findUnique({ where: { userId } }); if (link) return link.stripeCustomerId;
  const customer = await getStripeClient().customers.create(
    { email, metadata: { userId } },
    { idempotencyKey: `customer:${userId}` },
  );
  const saved = await prisma.stripeCustomerLink.upsert({ where: { userId }, create: { userId, stripeCustomerId: customer.id }, update: {} }); return saved.stripeCustomerId;
}

export function purchaserDisplayName(order: { purchaserFirstName?: string | null; purchaserLastName?: string | null }) {
  return [order.purchaserFirstName, order.purchaserLastName].map((part) => part?.trim()).filter(Boolean).join(" ");
}

/** Guest Checkout: reuse an existing Stripe Customer by purchaser email. Do not write StripeCustomerLink until account claim. */
export async function getOrCreateGuestStripeCustomer(order: {
  id: string;
  purchaserEmail: string | null;
  purchaserFirstName?: string | null;
  purchaserLastName?: string | null;
  stripeCustomerId: string | null;
}) {
  const email = (order.purchaserEmail ?? "").trim().toLowerCase();
  if (!email) throw new Error("Purchaser email is required for guest checkout.");
  const name = purchaserDisplayName(order) || undefined;
  if (order.stripeCustomerId) {
    if (name) await getStripeClient().customers.update(order.stripeCustomerId, { email, name });
    return order.stripeCustomerId;
  }
  const existing = await getStripeClient().customers.list({ email, limit: 1 });
  if (existing.data[0]?.id) {
    if (name) await getStripeClient().customers.update(existing.data[0].id, { email, name });
    return existing.data[0].id;
  }
  const customer = await getStripeClient().customers.create(
    { email, ...(name ? { name } : {}), metadata: { quantumReachOrderId: order.id } },
    { idempotencyKey: `guest-customer:${order.id}` },
  );
  return customer.id;
}

export async function createCheckout(orderId: string, actor: CheckoutActor) {
  const { order, products } = await checkoutProducts(orderId);
  assertCheckoutAccess(order, actor);
  const couponSnapshot = order.acceptedCouponSnapshot && typeof order.acceptedCouponSnapshot === "object" && !Array.isArray(order.acceptedCouponSnapshot) ? order.acceptedCouponSnapshot as Record<string, any> : null;
  const stripePromotionCodeId = couponSnapshot?.coupon?.stripePromotionCodeId as string | undefined;
  const stripeCouponId = couponSnapshot?.coupon?.stripeCouponId as string | undefined;
  if (couponSnapshot && !stripePromotionCodeId && !stripeCouponId) throw new Error("Accepted coupon requires an explicit Stripe mapping before checkout.");
  if (order.stripeCheckoutSessionId) {
    const current = await getStripeClient().checkout.sessions.retrieve(order.stripeCheckoutSessionId);
    if (current.status === "open" && current.url) return { url: current.url };
    if (current.status === "complete") throw new Error("Payment is already complete.");
  }
  const customer = order.userId
    ? await getOrCreateStripeCustomer(order.userId, actor.email ?? "")
    : await getOrCreateGuestStripeCustomer(order);
  const recurring = products.some((product) => product.recurring);
  const base = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const metadata: Stripe.MetadataParam = {
    quantumReachOrderId: order.id,
    ...(order.programEnrollmentId ? { programEnrollmentId: order.programEnrollmentId } : {}),
    ...(order.acquisitionSessionId ? { acquisitionAttributionId: order.acquisitionSessionId } : {}),
    ...(order.affiliateAttributionId ? { affiliateAttributionId: order.affiliateAttributionId } : {}),
  };
  const confirmation = `${base}/setup/confirmation?orderId=${encodeURIComponent(order.id)}&submitted=1`;
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: recurring ? "subscription" : "payment",
    customer,
    success_url: `${confirmation}&checkout=success`,
    cancel_url: `${confirmation}&checkout=cancelled`,
    metadata,
    line_items: products.map((product) => ({ price: product.stripePriceId, quantity: 1 })),
    ...(stripePromotionCodeId ? { discounts: [{ promotion_code: stripePromotionCodeId }] } : stripeCouponId ? { discounts: [{ coupon: stripeCouponId }] } : {}),
    ...(recurring
      ? { subscription_data: { metadata: { quantumReachOrderId: order.id }, ...(couponSnapshot?.coupon?.trialDays ? { trial_period_days: couponSnapshot.coupon.trialDays as number } : {}) } }
      : { payment_intent_data: { metadata: { quantumReachOrderId: order.id } } }),
  };
  const session = await getStripeClient().checkout.sessions.create(params, { idempotencyKey: `checkout:${order.id}` });
  if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
  await prisma.customerOrder.update({ where: { id: order.id }, data: { status: "CHECKOUT_PENDING", paymentMethod: "STRIPE", stripeCustomerId: customer, stripeCheckoutSessionId: session.id } });
  return { url: session.url };
}

/** When the success return arrives before the webhook, retrieve the session and apply the same clearance. */
export async function reconcilePaidCheckoutSession(orderId: string) {
  const order = await prisma.customerOrder.findUniqueOrThrow({ where: { id: orderId } });
  if (order.paymentStatus === "PAID") return { order, reconciled: false as const };
  if (!order.stripeCheckoutSessionId) return { order, reconciled: false as const };
  const session = await getStripeClient().checkout.sessions.retrieve(order.stripeCheckoutSessionId);
  const paid = session.status === "complete" && (session.payment_status === "paid" || session.payment_status === "no_payment_required");
  if (!paid) return { order, reconciled: false as const };
  await verifyStripePayment(order.id, `reconcile:${session.id}`, stripeObjectId(session.payment_intent), stripeObjectId(session.subscription));
  return { order: await prisma.customerOrder.findUniqueOrThrow({ where: { id: orderId } }), reconciled: true as const };
}

export async function createPortal(customerId: string, returnUrl: string) {
  return getStripeClient().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
}
