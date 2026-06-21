import { describe, expect, it, afterEach } from "vitest";
import { getBillingConfig, requireBillingConfigured } from "@/lib/billing/config";
import { isOperatorEmail } from "@/lib/admin/operator";
import { GET as healthGet } from "@/app/api/health/route";

describe("private beta readiness infrastructure", () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("keeps billing disabled and non-blocking when Stripe is not configured", () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    delete process.env.STRIPE_PRICE_ID_PRO;
    process.env.BILLING_ENABLED = "false";

    expect(getBillingConfig()).toMatchObject({ enabled: false, configured: false, hasSecret: false });
    expect(requireBillingConfigured()).toMatchObject({ ok: false, status: 503 });
  });

  it("requires explicit billing enablement plus Stripe variables", () => {
    process.env.BILLING_ENABLED = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_placeholder";
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_placeholder";
    process.env.STRIPE_PRICE_ID_TEAM = "price_placeholder";

    expect(getBillingConfig()).toMatchObject({ enabled: true, configured: true, hasWebhook: true });
    expect(requireBillingConfigured()).toMatchObject({ ok: true });
  });

  it("matches operator emails from a comma-separated allowlist", () => {
    process.env.ADMIN_EMAILS = "Founder@Example.com, ops@example.com";

    expect(isOperatorEmail("founder@example.com")).toBe(true);
    expect(isOperatorEmail("ops@example.com")).toBe(true);
    expect(isOperatorEmail("viewer@example.com")).toBe(false);
  });

  it("returns a minimal public health response", async () => {
    const response = healthGet();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, service: "quantumreach" });
    expect(body).not.toHaveProperty("databaseUrl");
  });
});
