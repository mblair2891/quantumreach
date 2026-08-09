import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  calculateExpectedReferralFee,
  resolvePartnerStatusLabel,
  safeReferredDisplayLabel,
} from "@/lib/affiliates/expected-fee";
import { DEFAULT_AFFILIATE_PROGRAM_CONFIG } from "@/lib/affiliates/program-config";

const source = (path: string) => readFileSync(path, "utf8");

describe("expected referral fee calculation", () => {
  const baseOrder = {
    paymentMethod: "SIMULATED_TEST",
    paymentStatus: "PAID",
    setupPriority: "STANDARD",
    acceptedCommercialTerms: {
      planName: "Growth",
      planKey: "GROWTH_SENDER_PACKAGE",
      recurringPriceCents: 59_700,
      setupPriceCents: 150_000,
    },
    acceptedCouponSnapshot: null,
    items: [{ itemType: "SENDING_PACKAGE", metadata: { productKey: "GROWTH_SENDER_PACKAGE" } }],
  };

  it("calculates percent of first package month by default without setup fees", () => {
    const fee = calculateExpectedReferralFee(baseOrder, DEFAULT_AFFILIATE_PROGRAM_CONFIG);
    expect(fee.commissionable).toBe(true);
    expect(fee.firstPaymentGrossCents).toBe(59_700);
    expect(fee.setupIncludedCents).toBe(0);
    expect(fee.rateBps).toBe(2000);
    expect(fee.expectedFeeCents).toBe(11_940); // 20% of 59700
    expect(fee.packageName).toBe("Growth");
  });

  it("includes setup fees when configured", () => {
    const fee = calculateExpectedReferralFee(baseOrder, {
      ...DEFAULT_AFFILIATE_PROGRAM_CONFIG,
      setupFeesCommissionable: true,
    });
    expect(fee.firstPaymentGrossCents).toBe(59_700 + 150_000);
    expect(fee.expectedFeeCents).toBe(Math.floor((209_700 * 2000) / 10_000));
  });

  it("blocks complimentary activations", () => {
    const fee = calculateExpectedReferralFee(
      { ...baseOrder, paymentMethod: "COMPLIMENTARY" },
      DEFAULT_AFFILIATE_PROGRAM_CONFIG,
    );
    expect(fee.commissionable).toBe(false);
    expect(fee.expectedFeeCents).toBe(0);
    expect(fee.reason).toBe("COMPLIMENTARY");
  });

  it("applies percentage-off coupons to first-month basis only", () => {
    const fee = calculateExpectedReferralFee(
      {
        ...baseOrder,
        acceptedCouponSnapshot: { coupon: { percentageOff: 20 } },
      },
      DEFAULT_AFFILIATE_PROGRAM_CONFIG,
    );
    expect(fee.firstPaymentGrossCents).toBe(Math.floor((59_700 * 80) / 100));
    expect(fee.expectedFeeCents).toBe(Math.floor((fee.firstPaymentGrossCents * 2000) / 10_000));
  });
});

describe("partner-facing labels", () => {
  it("masks email when name is absent", () => {
    expect(safeReferredDisplayLabel({ email: "alex@example.com" })).toBe("al***@example.com");
  });

  it("resolves pending hold then active", () => {
    const calculatedAt = new Date("2026-01-01T00:00:00.000Z");
    expect(resolvePartnerStatusLabel("PENDING", calculatedAt, 14, new Date("2026-01-02T00:00:00.000Z"))).toBe(
      "PENDING",
    );
    expect(resolvePartnerStatusLabel("PENDING", calculatedAt, 14, new Date("2026-01-20T00:00:00.000Z"))).toBe(
      "ACTIVE",
    );
    expect(resolvePartnerStatusLabel("PENDING", calculatedAt, 0, new Date("2026-01-01T00:00:00.000Z"))).toBe(
      "ACTIVE",
    );
  });
});

describe("affiliate partner platform contracts", () => {
  it("records partner referrals on fulfillment and keeps coupons separate", () => {
    const journey = source("lib/customer-journey/service.ts");
    const partner = source("lib/affiliates/partner-referrals.ts");
    const fee = source("lib/affiliates/expected-fee.ts");
    expect(journey).toContain("recordPartnerReferralOnActivation");
    expect(journey).toContain("tryCaptureReferralCodeForCheckout");
    expect(partner).toContain("SELF_REFERRAL");
    expect(partner).toContain("COMPLIMENTARY");
    expect(partner).toContain("partnerVisible");
    expect(fee).not.toMatch(/CommercialCoupon|applyCoupon/);
    expect(partner).not.toMatch(/CommercialCoupon|CouponRedemption/);
  });

  it("exposes partner dashboard list with expected fees and absolute link", () => {
    const page = source("app/dashboard/partner/referrals/page.tsx");
    const dash = source("lib/affiliates/partner-referrals.ts");
    expect(page).toContain("getPartnerReferralDashboard");
    expect(dash).toContain("https://www.quantumreach.app");
    expect(dash).toContain("/r/");
    expect(page).toContain("CopyValueButton");
    expect(page).toContain("Expected fee");
    expect(page).toContain("referredCount");
    expect(page).toContain("expectedFeesTotalLabel");
    expect(page).toContain("readOnly");
  });

  it("exposes operator affiliate program settings", () => {
    const page = source("app/platform/affiliates/settings/page.tsx");
    const actions = source("app/platform/affiliates/settings/actions.ts");
    const config = source("lib/affiliates/program-config.ts");
    const schema = source("prisma/schema.prisma");
    expect(page).toContain("firstPaymentRateBps");
    expect(page).toContain("setupFeesCommissionable");
    expect(page).toContain("holdDays");
    expect(actions).toContain("requireOperatorAccess");
    expect(actions).toContain("updateAffiliateProgramConfig");
    expect(config).toContain("AffiliateProgramConfig");
    expect(schema).toContain("model AffiliateProgramConfig");
    expect(schema).toContain("partnerVisible");
    expect(schema).toContain("expectedFeeCents");
  });
});
