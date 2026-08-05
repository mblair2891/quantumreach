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
