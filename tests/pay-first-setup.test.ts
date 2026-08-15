import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { hashSetupToken, generateRawSetupToken } from "@/lib/auth/setup-token-crypto";
import { ACCOUNT_SETUP_TOKEN_TTL_HOURS } from "@/lib/auth/constants";

const source = (path: string) => readFileSync(path, "utf8");

describe("pay-first account setup", () => {
  it("uses a 48 hour setup token lifetime", () => {
    expect(ACCOUNT_SETUP_TOKEN_TTL_HOURS).toBe(48);
  });

  it("hashes setup tokens deterministically without storing raw secrets in helpers", () => {
    const raw = generateRawSetupToken();
    expect(raw.length).toBeGreaterThan(20);
    expect(hashSetupToken(raw)).toBe(hashSetupToken(raw));
    expect(hashSetupToken(raw)).not.toBe(raw);
  });

  it("wires guest checkout without pre-payment sign-up", () => {
    const page = source("app/setup/confirmation/page.tsx");
    const actions = source("app/setup/confirmation/actions.ts");
    const service = source("lib/customer-journey/service.ts");
    expect(page).toContain("submitGuestCheckoutAction");
    expect(page).toContain("Pay first");
    expect(page).not.toContain("Create account and continue");
    expect(actions).toContain("createGuestAcquisitionOrder");
    expect(service).toContain("createGuestAcquisitionOrder");
    expect(service).toContain("purchaserEmail");
    expect(service).toContain("userId: null");
  });

  it("defers fulfillment for guest simulated payment until account setup", () => {
    const payment = source("lib/simulated-payment/service.ts");
    expect(payment).toContain("issueAccountSetupToken");
    expect(payment).toContain("requiresAccountSetup");
    expect(payment).toContain("isGuestOrder");
  });

  it("allows guest Stripe checkout without requireUserProfile and defers fulfill until claim", () => {
    const checkout = source("app/api/billing/checkout/route.ts");
    const commerce = source("lib/stripe/commerce.ts");
    const webhooks = source("lib/stripe/webhooks.ts");
    const service = source("lib/customer-journey/service.ts");
    const accountSetup = source("lib/auth/account-setup.ts");
    const confirmation = source("app/setup/confirmation/page.tsx");
    expect(checkout).toContain("getOptionalUserProfile");
    expect(checkout).toContain("acquisitionCookie");
    expect(checkout).not.toContain("requireUserProfile");
    expect(commerce).toContain("getOrCreateGuestStripeCustomer");
    expect(commerce).toContain("STANDARD_SETUP");
    expect(commerce).toContain("checkout=success");
    expect(commerce).toContain("reconcilePaidCheckoutSession");
    expect(commerce).not.toContain("mixes recurring and one-time");
    expect(webhooks).toContain("stripeSubscriptionId");
    expect(webhooks).not.toContain("cannot yet be correlated to a fulfilled workspace");
    expect(service).toContain("requiresAccountSetup: true");
    expect(service).toContain("if(!order.userId) return { requiresAccountSetup: true as const }");
    expect(accountSetup).toContain("stripeCustomerLink");
    expect(confirmation).toContain("StripeCheckoutButton");
    expect(confirmation).toContain("getBillingConfig");
    expect(confirmation).toContain("reconcilePaidCheckoutSession");
    expect(confirmation).toContain("issueAccountSetupToken");
  });

  it("never creates affiliate membership for complimentary clearance", () => {
    const service = source("lib/customer-journey/service.ts");
    expect(service).toContain('order.paymentMethod !== "COMPLIMENTARY"');
    expect(service).toContain("ensureAffiliateMembershipForActiveSubscriber");
  });

  it("exposes the setup account route", () => {
    expect(source("app/setup/account/page.tsx")).toContain("AccountSetupForm");
    expect(source("app/setup/account/actions.ts")).toContain("completeAccountSetup");
  });
});
