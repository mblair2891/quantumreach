import { prisma } from "@/lib/db/prisma";
import { stripeGet, stripePost } from "./client";
import { resolveStripePrice } from "./prices";

type Product = { id: string; key: string; recurring: boolean; active: boolean };
const productKey = (item: { itemType: string; metadata: unknown }, priority: string) => {
  const metadata = item.metadata as Record<string, unknown>; if (typeof metadata?.productKey === "string") return metadata.productKey;
  if (item.itemType === "SETUP_PRIORITY") return priority === "PRIORITY" ? "PRIORITY_SETUP" : priority === "EXPEDITED" ? "EXPEDITED_SETUP" : "STANDARD_SETUP";
  return undefined;
};
export async function checkoutProducts(orderId: string) {
  const order = await prisma.customerOrder.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  if (!["CHECKOUT_PENDING", "DRAFT", "FAILED"].includes(order.status) || order.paymentStatus === "PAID") throw new Error("This order is not eligible for checkout.");
  const setupKey = order.setupPriority === "PRIORITY" ? "PRIORITY_SETUP" : order.setupPriority === "EXPEDITED" ? "EXPEDITED_SETUP" : "STANDARD_SETUP";
  const keys = [...new Set(["QUANTUM_REACH_CORE", ...order.items.map((item) => productKey(item, order.setupPriority)).filter((key): key is string => Boolean(key)), setupKey])];
  const products = await prisma.commerceProduct.findMany({ where: { key: { in: [...new Set(keys)] }, active: true } });
  const byKey = new Map(products.map((product) => [product.key, product]));
  return { order, products: keys.map((key) => { const product = byKey.get(key); if (!product) throw new Error(`Unsupported or inactive commerce product: ${key}.`); return { ...product, stripePriceId: resolveStripePrice(key) } as Product & { stripePriceId: string }; }) };
}
export async function getOrCreateStripeCustomer(userId: string, email: string) {
  const link = await prisma.stripeCustomerLink.findUnique({ where: { userId } }); if (link) return link.stripeCustomerId;
  const customer = await stripePost<{ id: string }>("/customers", { email, "metadata[userId]": userId }, `customer:${userId}`);
  const saved = await prisma.stripeCustomerLink.upsert({ where: { userId }, create: { userId, stripeCustomerId: customer.id }, update: {} }); return saved.stripeCustomerId;
}
export async function createCheckout(orderId: string, user: { id: string; email: string }) {
  const { order, products } = await checkoutProducts(orderId); if (order.userId !== user.id) throw new Error("Order ownership validation failed.");
  if (order.stripeCheckoutSessionId) {
    const current = await stripeGet<{ status: string; url: string | null }>(`/checkout/sessions/${encodeURIComponent(order.stripeCheckoutSessionId)}`);
    if (current.status === "open" && current.url) return { url: current.url };
    if (current.status === "complete") throw new Error("Payment is already complete.");
  }
  const customer = await getOrCreateStripeCustomer(user.id, user.email); const recurring = products.some((product) => product.recurring);
  if (recurring && products.some((product) => !product.recurring)) throw new Error("This order mixes recurring and one-time products and cannot use one Checkout Session.");
  const base = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const body: Record<string, string | number | boolean | undefined> = { mode: recurring ? "subscription" : "payment", customer, success_url: `${base}/setup/status`, cancel_url: `${base}/setup/confirmation?checkout=cancelled`, "metadata[quantumReachOrderId]": order.id, "metadata[programEnrollmentId]": order.programEnrollmentId || undefined, "metadata[acquisitionAttributionId]": order.acquisitionSessionId || undefined, "metadata[affiliateAttributionId]": order.affiliateAttributionId || undefined };
  body[recurring ? "subscription_data[metadata][quantumReachOrderId]" : "payment_intent_data[metadata][quantumReachOrderId]"] = order.id;
  products.forEach((product, index) => { body[`line_items[${index}][price]`] = product.stripePriceId!; body[`line_items[${index}][quantity]`] = 1; });
  const session = await stripePost<{ id: string; url: string }>("/checkout/sessions", body, `checkout:${order.id}`);
  await prisma.customerOrder.update({ where: { id: order.id }, data: { status: "CHECKOUT_PENDING", paymentMethod: "STRIPE", stripeCustomerId: customer, stripeCheckoutSessionId: session.id } });
  return { url: session.url };
}
export async function createPortal(customerId: string, returnUrl: string) { return stripePost<{ url: string }>("/billing_portal/sessions", { customer: customerId, return_url: returnUrl }); }
