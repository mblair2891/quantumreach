import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { COMMON_TIMEZONES, DEFAULT_CHECKOUT_TIMEZONE, normalizeCheckoutTimezone } from "@/lib/customer-journey/timezones";

const source = (path: string) => readFileSync(path, "utf8");

describe("pay-first checkout form", () => {
  it("exposes a timezone dropdown with common IANA zones", () => {
    expect(COMMON_TIMEZONES.length).toBeGreaterThanOrEqual(10);
    expect(COMMON_TIMEZONES.some((zone) => zone.value === DEFAULT_CHECKOUT_TIMEZONE)).toBe(true);
    expect(normalizeCheckoutTimezone("America/Los_Angeles")).toBe("America/Los_Angeles");
    expect(normalizeCheckoutTimezone("not-a-zone")).toBe(DEFAULT_CHECKOUT_TIMEZONE);
  });

  it("uses a timezone select and omits business name, business type, and intended use", () => {
    const page = source("app/setup/confirmation/page.tsx");
    const actions = source("app/setup/confirmation/actions.ts");
    const service = source("lib/customer-journey/service.ts");
    expect(page).toContain('name="timezone"');
    expect(page).toContain("COMMON_TIMEZONES");
    expect(page).toContain("<select");
    expect(page).not.toContain('name="businessName"');
    expect(page).not.toContain('name="businessType"');
    expect(page).not.toContain('name="intendedUse"');
    expect(page).not.toContain("Business name");
    expect(page).not.toContain("Business type");
    expect(page).not.toContain("Intended use");
    expect(actions).not.toContain("businessName");
    expect(actions).not.toContain("businessType");
    expect(actions).not.toContain("intendedUse");
    expect(actions).toContain("isRedirectError");
    expect(service).toContain("GuestPurchaserInput");
    expect(service).toContain("normalizeCheckoutTimezone");
    expect(service).toContain("businessName: null");
  });

  it("supports optional referral code prefill and checkout capture separate from coupons", () => {
    const page = source("app/setup/confirmation/page.tsx");
    const actions = source("app/setup/confirmation/actions.ts");
    const service = source("lib/customer-journey/service.ts");
    const affiliates = source("lib/affiliates/service.ts");
    expect(page).toContain('name="referralCode"');
    expect(page).toContain("getCapturedReferralCodeForSession");
    expect(page).toContain("prefilledReferralCode");
    expect(actions).toContain("referralCode");
    expect(service).toContain("tryCaptureReferralCodeForCheckout");
    expect(service).toContain("referralCode");
    expect(affiliates).toContain("tryCaptureReferralCodeForCheckout");
    // Coupons remain a separate form/action path.
    expect(page).toContain("applyCouponAction");
    expect(actions).toContain("applyCoupon");
    expect(service).not.toMatch(/applyCoupon.*referralCode|referralCode.*applyCoupon/);
  });
});
