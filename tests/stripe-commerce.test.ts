import { beforeEach, describe, expect, it, vi } from "vitest";

const db = {
  customerOrder: { findUniqueOrThrow: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
  commerceProduct: { findMany: vi.fn() },
  stripeCustomerLink: { findUnique: vi.fn(), upsert: vi.fn() },
  stripeWebhookEvent: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  stripePaymentRecord: { findUnique: vi.fn(), upsert: vi.fn() },
  stripeRefundRecord: { upsert: vi.fn() }, stripeDisputeRecord: { upsert: vi.fn() },
  affiliateAttribution: { findUnique: vi.fn() }, affiliateAccount: { findUnique: vi.fn() }, affiliateCommission: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  saasSubscription: { upsert: vi.fn(), findUnique: vi.fn() }, userProfile: { findUniqueOrThrow: vi.fn() }, saasSubscriptionItem: { upsert: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(async (work: any) => work(db)),
};
const reconcileAffiliate = vi.fn();
const createCustomer = vi.fn(); const listCustomers = vi.fn(); const createSession = vi.fn(); const retrieveSession = vi.fn(); const createPortalSession = vi.fn(); const constructEvent = vi.fn(); const fulfill = vi.fn();
const stripeClient = {
  customers: { create: createCustomer, list: listCustomers },
  checkout: { sessions: { create: createSession, retrieve: retrieveSession } },
  billingPortal: { sessions: { create: createPortalSession } },
  webhooks: { constructEvent },
};
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/stripe/client", () => ({ getStripeClient: () => stripeClient }));
vi.mock("@/lib/customer-journey/service", () => ({ verifyStripePayment: fulfill }));
vi.mock("@/lib/affiliates/service", () => ({ reconcileAffiliateMembershipForSubscriptionStatus: reconcileAffiliate }));

const order = { id: "order_1", userId: "user_1", status: "CHECKOUT_PENDING", paymentStatus: "UNPAID", setupPriority: "STANDARD", programEnrollmentId: "enrollment_1", acquisitionSessionId: "acq_1", affiliateAttributionId: "attr_1", items: [{ itemType: "SENDING_PACKAGE", metadata: { productKey: "GROWTH_SENDER_PACKAGE" } }] };
const products = [{ id: "core", key: "QUANTUM_REACH_CORE", recurring: true, active: true }, { id: "growth", key: "GROWTH_SENDER_PACKAGE", recurring: true, active: true }];

describe("Stripe checkout and webhook boundaries", () => {
  beforeEach(() => { vi.clearAllMocks(); db.customerOrder.findUniqueOrThrow.mockResolvedValue(order); db.commerceProduct.findMany.mockResolvedValue(products); db.userProfile.findUniqueOrThrow.mockResolvedValue({ id: "user_1", email: "buyer@example.com", firstName: "Buyer", lastName: "Person" }); db.stripeCustomerLink.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1" }); createSession.mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.test/session" }); listCustomers.mockResolvedValue({ data: [] }); process.env.STRIPE_SECRET_KEY = "sk_test"; process.env.STRIPE_WEBHOOK_SECRET = "whsec_test"; process.env.STRIPE_PRICE_QUANTUM_REACH_CORE="price_core"; process.env.STRIPE_PRICE_GROWTH_SENDER_PACKAGE="price_growth"; process.env.STRIPE_PRICE_STANDARD_SETUP="price_setup"; process.env.STRIPE_PRICE_PRIORITY_SETUP="price_priority"; });
  it("uses persisted catalog pricing, stable metadata, and the SDK idempotency option", async () => { const { createCheckout } = await import("@/lib/stripe/commerce"); await createCheckout("order_1", { id: "user_1", email: "buyer@example.com" }); expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ line_items: [{ price: "price_core", quantity: 1 }, { price: "price_growth", quantity: 1 }], metadata: expect.objectContaining({ quantumReachOrderId: "order_1", acquisitionAttributionId: "acq_1", affiliateAttributionId: "attr_1" }) }), { idempotencyKey: "checkout:order_1" }); expect(db.customerOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.not.objectContaining({ paymentStatus: "PAID" }) })); });
  it("rejects missing environment Price IDs before creating Checkout", async () => { delete process.env.STRIPE_PRICE_GROWTH_SENDER_PACKAGE; const { createCheckout } = await import("@/lib/stripe/commerce"); await expect(createCheckout("order_1", { id: "user_1", email: "buyer@example.com" })).rejects.toThrow("Stripe price mapping"); expect(createSession).not.toHaveBeenCalled(); });
  it("enforces persisted order ownership", async () => { const { createCheckout } = await import("@/lib/stripe/commerce"); await expect(createCheckout("order_1", { id: "attacker", email: "attacker@example.com" })).rejects.toThrow("ownership"); expect(createSession).not.toHaveBeenCalled(); });
  it("reuses an open SDK Checkout Session", async () => { db.customerOrder.findUniqueOrThrow.mockResolvedValue({ ...order, stripeCheckoutSessionId: "cs_open" }); retrieveSession.mockResolvedValue({ status: "open", url: "https://checkout.stripe.test/existing" }); const { createCheckout } = await import("@/lib/stripe/commerce"); await expect(createCheckout("order_1", { id: "user_1", email: "buyer@example.com" })).resolves.toEqual({ url: "https://checkout.stripe.test/existing" }); expect(createSession).not.toHaveBeenCalled(); });
  it("rejects a completed SDK Checkout Session", async () => { db.customerOrder.findUniqueOrThrow.mockResolvedValue({ ...order, stripeCheckoutSessionId: "cs_complete" }); retrieveSession.mockResolvedValue({ status: "complete", url: null }); const { createCheckout } = await import("@/lib/stripe/commerce"); await expect(createCheckout("order_1", { id: "user_1", email: "buyer@example.com" })).rejects.toThrow("already complete"); });
  it("creates customers with an SDK idempotency request option", async () => { db.stripeCustomerLink.findUnique.mockResolvedValue(null); createCustomer.mockResolvedValue({ id: "cus_new" }); db.stripeCustomerLink.upsert.mockResolvedValue({ stripeCustomerId: "cus_new" }); const { getOrCreateStripeCustomer } = await import("@/lib/stripe/commerce"); await getOrCreateStripeCustomer("user_1", "buyer@example.com"); expect(createCustomer).toHaveBeenCalledWith({ email: "buyer@example.com", metadata: { userId: "user_1" } }, { idempotencyKey: "customer:user_1" }); });
  it("uses the SDK customer portal boundary", async () => { createPortalSession.mockResolvedValue({ url: "https://billing.stripe.test/portal" }); const { createPortal } = await import("@/lib/stripe/commerce"); await createPortal("cus_1", "https://app.test/dashboard"); expect(createPortalSession).toHaveBeenCalledWith({ customer: "cus_1", return_url: "https://app.test/dashboard" }); });
  it("rejects a webhook without Stripe-Signature before SDK verification", async () => { const { POST } = await import("@/app/api/webhooks/stripe/route"); const response = await POST(new Request("http://app.test/api/webhooks/stripe", { method: "POST", body: "{}" })); expect(response.status).toBe(400); expect(constructEvent).not.toHaveBeenCalled(); });
  it("passes the untouched body to SDK verification and rejects tampering", async () => { constructEvent.mockImplementation(() => { throw new Error("No signatures found matching the expected signature for payload"); }); const { POST } = await import("@/app/api/webhooks/stripe/route"); const rawBody = '{"id":"evt_tampered"}'; const response = await POST(new Request("http://app.test/api/webhooks/stripe", { method: "POST", body: rawBody, headers: { "Stripe-Signature": "t=1,v1=invalid" } })); expect(response.status).toBe(400); expect(constructEvent).toHaveBeenCalledWith(rawBody, "t=1,v1=invalid", "whsec_test"); });
  it("processes an SDK-verified event and makes its replay a no-op", async () => { const event = { id: "evt_verified", type: "checkout.session.completed", data: { object: {} } }; constructEvent.mockReturnValue(event); db.stripeWebhookEvent.findUnique.mockResolvedValue({ id: "record_1", status: "PROCESSED" }); const { POST } = await import("@/app/api/webhooks/stripe/route"); const request = () => new Request("http://app.test/api/webhooks/stripe", { method: "POST", body: '{"id":"evt_verified"}', headers: { "Stripe-Signature": "sdk-compatible-header" } }); expect((await POST(request())).status).toBe(200); expect((await POST(request())).status).toBe(200); expect(fulfill).not.toHaveBeenCalled(); });
  it("treats an already processed delivery as a no-op", async () => { db.stripeWebhookEvent.findUnique.mockResolvedValue({ id: "record_1", status: "PROCESSED" }); const { processStripeEvent } = await import("@/lib/stripe/webhooks"); await processStripeEvent({ id: "evt_done", type: "checkout.session.completed", data: { object: {} } }); expect(fulfill).not.toHaveBeenCalled(); });
  it("records a verified payment and invokes centralized Stripe clearance", async () => { db.stripeWebhookEvent.findUnique.mockResolvedValue(null); db.stripeWebhookEvent.create.mockResolvedValue({ id: "record_1" }); db.customerOrder.findUnique.mockResolvedValue({ ...order, workspaceId: "workspace_1", stripeCustomerId: "cus_1" }); const { processStripeEvent } = await import("@/lib/stripe/webhooks"); await processStripeEvent({ id: "evt_paid", type: "checkout.session.completed", data: { object: { id: "cs_1", metadata: { quantumReachOrderId: "order_1" }, payment_status: "paid", payment_intent: "pi_1", amount_total: 5000, currency: "usd" } } }); expect(fulfill).toHaveBeenCalledWith("order_1", "evt_paid", "pi_1", undefined); });
  it("creates an internal Stripe subscription and Stripe-provenance item", async () => { db.stripeWebhookEvent.findUnique.mockResolvedValue(null); db.stripeWebhookEvent.create.mockResolvedValue({ id: "record_1" }); db.customerOrder.findUnique.mockResolvedValue({ ...order, workspaceId: "workspace_1", stripeCustomerId: "cus_1" }); db.saasSubscription.upsert.mockResolvedValue({ id: "sub_internal" }); const { processStripeEvent } = await import("@/lib/stripe/webhooks"); await processStripeEvent({ id: "evt_sub", type: "customer.subscription.created", data: { object: { id: "sub_1", metadata: { customerOrderId: "order_1" }, status: "active", items: { data: [{ id: "si_1", quantity: 1, price: { id: "price_growth" } }] } } } }); expect(db.saasSubscription.upsert).toHaveBeenCalled(); expect(reconcileAffiliate).toHaveBeenCalledWith(expect.objectContaining({userId:"user_1",subscriptionId:"sub_internal",correlationId:"evt_sub",status:"ACTIVE"})); expect(db.saasSubscriptionItem.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ source: "STRIPE", stripeSubscriptionItemId: "si_1" }) })); });
  it("keeps affiliate membership for scheduled cancellation and ends it only on actual access-ending status", async () => { db.stripeWebhookEvent.findUnique.mockResolvedValue(null); db.stripeWebhookEvent.create.mockResolvedValue({ id: "record_1" }); db.customerOrder.findUnique.mockResolvedValue({ ...order, workspaceId: "workspace_1", stripeCustomerId: "cus_1" }); db.saasSubscription.upsert.mockResolvedValue({ id: "sub_internal" }); const { processStripeEvent } = await import("@/lib/stripe/webhooks"); await processStripeEvent({ id: "evt_scheduled", type: "customer.subscription.updated", data: { object: { id: "sub_1", metadata: { customerOrderId: "order_1" }, status: "active", cancel_at_period_end: true, items: { data: [] } } } }); expect(reconcileAffiliate).toHaveBeenLastCalledWith(expect.objectContaining({ status: "ACTIVE", correlationId: "evt_scheduled" })); db.stripeWebhookEvent.findUnique.mockResolvedValue(null); await processStripeEvent({ id: "evt_canceled", type: "customer.subscription.deleted", data: { object: { id: "sub_1", metadata: { customerOrderId: "order_1" }, status: "canceled", items: { data: [] } } } }); expect(reconcileAffiliate).toHaveBeenLastCalledWith(expect.objectContaining({ status: "CANCELED", correlationId: "evt_canceled" })); });
  it("returns confirmation success and cancel URLs with the order id", async () => {
    const { createCheckout } = await import("@/lib/stripe/commerce");
    await createCheckout("order_1", { id: "user_1", email: "buyer@example.com" });
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      success_url: expect.stringMatching(/\/setup\/confirmation\?.*orderId=order_1.*checkout=success/),
      cancel_url: expect.stringMatching(/\/setup\/confirmation\?.*orderId=order_1.*checkout=cancelled/),
    }), { idempotencyKey: "checkout:order_1" });
  });
  it("omits Standard Setup from Stripe line items", async () => {
    db.customerOrder.findUniqueOrThrow.mockResolvedValue({
      ...order,
      items: [
        { itemType: "SENDING_PACKAGE", metadata: { productKey: "GROWTH_SENDER_PACKAGE" } },
        { itemType: "SETUP_PRIORITY", metadata: { productKey: "STANDARD_SETUP", priority: "STANDARD" } },
      ],
    });
    const { createCheckout } = await import("@/lib/stripe/commerce");
    await createCheckout("order_1", { id: "user_1", email: "buyer@example.com" });
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      line_items: [{ price: "price_core", quantity: 1 }, { price: "price_growth", quantity: 1 }],
    }), expect.anything());
  });
  it("allows Priority Setup as a one-time item on a subscription Checkout Session", async () => {
    db.customerOrder.findUniqueOrThrow.mockResolvedValue({
      ...order,
      setupPriority: "PRIORITY",
      items: [
        { itemType: "SENDING_PACKAGE", metadata: { productKey: "GROWTH_SENDER_PACKAGE" } },
        { itemType: "SETUP_PRIORITY", metadata: { productKey: "PRIORITY_SETUP", priority: "PRIORITY" } },
      ],
    });
    db.commerceProduct.findMany.mockResolvedValue([
      ...products,
      { id: "priority", key: "PRIORITY_SETUP", recurring: false, active: true },
    ]);
    const { createCheckout } = await import("@/lib/stripe/commerce");
    await createCheckout("order_1", { id: "user_1", email: "buyer@example.com" });
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      mode: "subscription",
      line_items: [
        { price: "price_core", quantity: 1 },
        { price: "price_growth", quantity: 1 },
        { price: "price_priority", quantity: 1 },
      ],
    }), expect.anything());
  });
  it("creates a guest Stripe customer from purchaser email without a customer link", async () => {
    db.customerOrder.findUniqueOrThrow.mockResolvedValue({ ...order, userId: null, purchaserEmail: "guest@example.com", stripeCustomerId: null });
    createCustomer.mockResolvedValue({ id: "cus_guest" });
    const { createCheckout } = await import("@/lib/stripe/commerce");
    await createCheckout("order_1", { acquisitionSessionId: "acq_1" });
    expect(createCustomer).toHaveBeenCalledWith({ email: "guest@example.com", metadata: { quantumReachOrderId: "order_1" } }, { idempotencyKey: "guest-customer:order_1" });
    expect(db.stripeCustomerLink.upsert).not.toHaveBeenCalled();
  });
  it("allows guest checkout when the acquisition session or purchaser email matches", async () => {
    db.customerOrder.findUniqueOrThrow.mockResolvedValue({ ...order, userId: null, purchaserEmail: "guest@example.com", stripeCustomerId: "cus_saved" });
    const { createCheckout } = await import("@/lib/stripe/commerce");
    await expect(createCheckout("order_1", {})).rejects.toThrow("ownership");
    await expect(createCheckout("order_1", { acquisitionSessionId: "other" })).rejects.toThrow("ownership");
    await expect(createCheckout("order_1", { email: "other@example.com" })).rejects.toThrow("ownership");
    await expect(createCheckout("order_1", { acquisitionSessionId: "acq_1" })).resolves.toEqual({ url: "https://checkout.stripe.test/session" });
    await expect(createCheckout("order_1", { email: "guest@example.com" })).resolves.toEqual({ url: "https://checkout.stripe.test/session" });
    expect(createCustomer).not.toHaveBeenCalled();
    expect(db.stripeCustomerLink.upsert).not.toHaveBeenCalled();
  });
  it("reuses a Stripe customer listed by purchaser email for guest checkout", async () => {
    db.customerOrder.findUniqueOrThrow.mockResolvedValue({ ...order, userId: null, purchaserEmail: "guest@example.com", stripeCustomerId: null });
    listCustomers.mockResolvedValue({ data: [{ id: "cus_listed" }] });
    const { createCheckout } = await import("@/lib/stripe/commerce");
    await createCheckout("order_1", { acquisitionSessionId: "acq_1" });
    expect(listCustomers).toHaveBeenCalledWith({ email: "guest@example.com", limit: 1 });
    expect(createCustomer).not.toHaveBeenCalled();
    expect(db.customerOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ stripeCustomerId: "cus_listed", paymentMethod: "STRIPE" }) }));
  });
  it("reconciles a completed Checkout Session when the webhook is late", async () => {
    db.customerOrder.findUniqueOrThrow.mockResolvedValue({ ...order, stripeCheckoutSessionId: "cs_1", paymentStatus: "UNPAID" });
    retrieveSession.mockResolvedValue({ id: "cs_1", status: "complete", payment_status: "paid", payment_intent: "pi_1", subscription: "sub_1" });
    const { reconcilePaidCheckoutSession } = await import("@/lib/stripe/commerce");
    await reconcilePaidCheckoutSession("order_1");
    expect(fulfill).toHaveBeenCalledWith("order_1", "reconcile:cs_1", "pi_1", "sub_1");
  });
  it("defers subscription sync until the guest order has a user and workspace", async () => {
    db.stripeWebhookEvent.findUnique.mockResolvedValue(null);
    db.stripeWebhookEvent.create.mockResolvedValue({ id: "record_1" });
    db.customerOrder.findUnique.mockResolvedValue({ ...order, userId: null, workspaceId: null, stripeCustomerId: "cus_1" });
    const { processStripeEvent } = await import("@/lib/stripe/webhooks");
    await processStripeEvent({ id: "evt_sub_guest", type: "customer.subscription.created", data: { object: { id: "sub_1", metadata: { customerOrderId: "order_1" }, status: "active", items: { data: [] } } } });
    expect(db.saasSubscription.upsert).not.toHaveBeenCalled();
    expect(reconcileAffiliate).not.toHaveBeenCalled();
    expect(db.customerOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: { stripeSubscriptionId: "sub_1" } }));
    expect(db.stripeWebhookEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PROCESSED" }) }));
  });
});
