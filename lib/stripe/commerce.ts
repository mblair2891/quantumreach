/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
import Stripe from "stripe";
import { getStripeClient } from "./client";
import { resolveStripePrice } from "./prices";

type Product = { id: string; key: string; recurring: boolean; active: boolean };
const productKey = (item: { itemType: string; metadata: unknown }, priority: string) => {
  const metadata = item.metadata as Record<string, unknown>; if (typeof metadata?.productKey === "string") return metadata.productKey;
  if (item.itemType === "SETUP_PRIORITY") return priority === "PRIORITY" ? "PRIORITY_SETUP" : undefined;
  return undefined;
};
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
export async function createCheckout(orderId: string, user: { id: string; email: string }) {
  const { order, products } = await checkoutProducts(orderId); if (order.userId !== user.id) throw new Error("Order ownership validation failed.");
  const couponSnapshot = order.acceptedCouponSnapshot && typeof order.acceptedCouponSnapshot === "object" && !Array.isArray(order.acceptedCouponSnapshot) ? order.acceptedCouponSnapshot as Record<string, any> : null;
  const stripePromotionCodeId = couponSnapshot?.coupon?.stripePromotionCodeId as string | undefined;
  const stripeCouponId = couponSnapshot?.coupon?.stripeCouponId as string | undefined;
  if (couponSnapshot && !stripePromotionCodeId && !stripeCouponId) throw new Error("Accepted coupon requires an explicit Stripe mapping before checkout.");
  if (order.stripeCheckoutSessionId) {
    const current = await getStripeClient().checkout.sessions.retrieve(order.stripeCheckoutSessionId);
    if (current.status === "open" && current.url) return { url: current.url };
    if (current.status === "complete") throw new Error("Payment is already complete.");
  }
  const customer = await getOrCreateStripeCustomer(user.id, user.email); const recurring = products.some((product) => product.recurring);
  if (recurring && products.some((product) => !product.recurring)) throw new Error("This order mixes recurring and one-time products and cannot use one Checkout Session.");
  const base = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const metadata: Stripe.MetadataParam = {
    quantumReachOrderId: order.id,
    ...(order.programEnrollmentId ? { programEnrollmentId: order.programEnrollmentId } : {}),
    ...(order.acquisitionSessionId ? { acquisitionAttributionId: order.acquisitionSessionId } : {}),
    ...(order.affiliateAttributionId ? { affiliateAttributionId: order.affiliateAttributionId } : {}),
  };
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: recurring ? "subscription" : "payment",
    customer,
    success_url: `${base}/setup/status`,
    cancel_url: `${base}/setup/confirmation?checkout=cancelled`,
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
export async function createPortal(customerId: string, returnUrl: string) {
  return getStripeClient().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
}
