import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = {
  customerOrder: { findUniqueOrThrow: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
  commerceProduct: { findMany: vi.fn() },
  stripeCustomerLink: { findUnique: vi.fn(), upsert: vi.fn() },
  stripeWebhookEvent: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  stripePaymentRecord: { findUnique: vi.fn(), upsert: vi.fn() },
  stripeRefundRecord: { upsert: vi.fn() }, stripeDisputeRecord: { upsert: vi.fn() },
  affiliateAttribution: { findUnique: vi.fn() }, affiliateAccount: { findUnique: vi.fn() }, affiliateCommission: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  saasSubscription: { upsert: vi.fn(), findUnique: vi.fn() }, saasSubscriptionItem: { upsert: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(async (work: any) => work(db)),
};
const stripePost = vi.fn(); const fulfill = vi.fn();
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/stripe/client", async () => ({ stripePost, verifyStripeSignature: (await import("@/lib/stripe/client")).verifyStripeSignature }));
vi.mock("@/lib/customer-journey/service", () => ({ fulfillCustomerOrder: fulfill }));

const order = { id: "order_1", userId: "user_1", status: "CHECKOUT_PENDING", paymentStatus: "UNPAID", setupPriority: "STANDARD", programEnrollmentId: "enrollment_1", acquisitionSessionId: "acq_1", affiliateAttributionId: "attr_1", items: [{ itemType: "SENDING_PACKAGE", metadata: { productKey: "GROWTH_SENDER_PACKAGE" } }] };
const products = [{ id: "core", key: "QUANTUM_REACH_CORE", stripePriceId: "price_core", recurring: true, active: true }, { id: "growth", key: "GROWTH_SENDER_PACKAGE", stripePriceId: "price_growth", recurring: true, active: true }];

describe("Stripe checkout and webhook boundaries", () => {
  beforeEach(() => { vi.clearAllMocks(); db.customerOrder.findUniqueOrThrow.mockResolvedValue(order); db.commerceProduct.findMany.mockResolvedValue(products); db.stripeCustomerLink.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1" }); stripePost.mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.test/session" }); process.env.STRIPE_SECRET_KEY = "sk_test"; process.env.STRIPE_WEBHOOK_SECRET = "whsec_test"; });
  it("uses persisted order/catalog products and correlation metadata, not browser pricing", async () => { const { createCheckout } = await import("@/lib/stripe/commerce"); await createCheckout("order_1", { id: "user_1", email: "buyer@example.com" }); expect(stripePost).toHaveBeenCalledWith("/checkout/sessions", expect.objectContaining({ "line_items[0][price]": "price_core", "line_items[1][price]": "price_growth", "metadata[customerOrderId]": "order_1" }), "checkout:order_1"); expect(db.customerOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.not.objectContaining({ paymentStatus: "PAID" }) })); });
  it("rejects missing catalog Price IDs before creating Checkout", async () => { db.commerceProduct.findMany.mockResolvedValue([{ ...products[0], stripePriceId: null }]); const { createCheckout } = await import("@/lib/stripe/commerce"); await expect(createCheckout("order_1", { id: "user_1", email: "buyer@example.com" })).rejects.toThrow("Stripe price mapping"); expect(stripePost).not.toHaveBeenCalled(); });
  it("enforces persisted order ownership", async () => { const { createCheckout } = await import("@/lib/stripe/commerce"); await expect(createCheckout("order_1", { id: "attacker", email: "attacker@example.com" })).rejects.toThrow("ownership"); expect(stripePost).not.toHaveBeenCalled(); });
  it("accepts valid and rejects invalid signed raw webhook payloads", async () => { const { verifyStripeSignature } = await import("@/lib/stripe/client"); const payload = '{"id":"evt_1"}'; const timestamp = Math.floor(Date.now() / 1000); const signature = createHmac("sha256", "whsec_test").update(`${timestamp}.${payload}`).digest("hex"); expect(verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, "whsec_test")).toBe(true); expect(verifyStripeSignature(payload, "t=1,v1=bad", "whsec_test")).toBe(false); });
  it("treats an already processed delivery as a no-op", async () => { db.stripeWebhookEvent.findUnique.mockResolvedValue({ id: "record_1", status: "PROCESSED" }); const { processStripeEvent } = await import("@/lib/stripe/webhooks"); await processStripeEvent({ id: "evt_done", type: "checkout.session.completed", data: { object: {} } }); expect(fulfill).not.toHaveBeenCalled(); });
  it("records a verified payment and invokes shared fulfillment", async () => { db.stripeWebhookEvent.findUnique.mockResolvedValue(null); db.stripeWebhookEvent.create.mockResolvedValue({ id: "record_1" }); db.customerOrder.findUnique.mockResolvedValue({ ...order, workspaceId: "workspace_1", stripeCustomerId: "cus_1" }); const { processStripeEvent } = await import("@/lib/stripe/webhooks"); await processStripeEvent({ id: "evt_paid", type: "checkout.session.completed", data: { object: { id: "cs_1", metadata: { customerOrderId: "order_1" }, payment_intent: "pi_1", amount_total: 5000, currency: "usd" } } }); expect(db.customerOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paymentMethod: "STRIPE", paymentStatus: "PAID" }) })); expect(fulfill).toHaveBeenCalledWith("order_1"); });
  it("creates an internal Stripe subscription and Stripe-provenance item", async () => { db.stripeWebhookEvent.findUnique.mockResolvedValue(null); db.stripeWebhookEvent.create.mockResolvedValue({ id: "record_1" }); db.customerOrder.findUnique.mockResolvedValue({ ...order, workspaceId: "workspace_1", stripeCustomerId: "cus_1" }); db.saasSubscription.upsert.mockResolvedValue({ id: "sub_internal" }); const { processStripeEvent } = await import("@/lib/stripe/webhooks"); await processStripeEvent({ id: "evt_sub", type: "customer.subscription.created", data: { object: { id: "sub_1", metadata: { customerOrderId: "order_1" }, status: "active", items: { data: [{ id: "si_1", quantity: 1, price: { id: "price_growth" } }] } } } }); expect(db.saasSubscription.upsert).toHaveBeenCalled(); expect(db.saasSubscriptionItem.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ source: "STRIPE", stripeSubscriptionItemId: "si_1" }) })); });
});
