import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  calculateExpectedReferralFee,
  computeExpectedPaidOutAt,
  resolveLedgerStatus,
  resolvePartnerStatusLabel,
  safeReferredDisplayLabel,
} from "@/lib/affiliates/expected-fee";
import { DEFAULT_AFFILIATE_PROGRAM_CONFIG, DEFAULT_HOLD_DAYS, resolveHoldDays } from "@/lib/affiliates/program-config";

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
    expect(fee.expectedFeeCents).toBe(11_940);
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

describe("ledger balance and expected paid-out date", () => {
  it("uses default hold days of 14 when missing", () => {
    expect(DEFAULT_HOLD_DAYS).toBe(14);
    expect(resolveHoldDays(null)).toBe(14);
    expect(resolveHoldDays(undefined)).toBe(14);
    expect(resolveHoldDays(-1)).toBe(14);
    expect(resolveHoldDays(7)).toBe(7);
  });

  it("computes expected paid-out as activation + hold days", () => {
    const activation = new Date("2026-01-01T12:00:00.000Z");
    expect(computeExpectedPaidOutAt(activation, 14).toISOString()).toBe("2026-01-15T12:00:00.000Z");
    expect(computeExpectedPaidOutAt(activation, 0).toISOString()).toBe("2026-01-01T12:00:00.000Z");
  });

  it("moves pending → available after hold, and paid is sticky", () => {
    const activation = new Date("2026-01-01T00:00:00.000Z");
    const expectedPaidOutAt = computeExpectedPaidOutAt(activation, 14);
    expect(
      resolveLedgerStatus({
        ledgerStatus: "PENDING",
        feeCalculatedAt: activation,
        expectedPaidOutAt,
        holdDays: 14,
        now: new Date("2026-01-02T00:00:00.000Z"),
      }),
    ).toBe("PENDING");
    expect(
      resolveLedgerStatus({
        ledgerStatus: "PENDING",
        feeCalculatedAt: activation,
        expectedPaidOutAt,
        holdDays: 14,
        now: new Date("2026-01-16T00:00:00.000Z"),
      }),
    ).toBe("AVAILABLE");
    expect(
      resolveLedgerStatus({
        ledgerStatus: "PAID",
        paidOutAt: new Date("2026-01-20T00:00:00.000Z"),
        feeCalculatedAt: activation,
        expectedPaidOutAt,
        holdDays: 14,
        now: new Date("2026-02-01T00:00:00.000Z"),
      }),
    ).toBe("PAID");
  });

  it("maps legacy partner labels for hold completion", () => {
    const calculatedAt = new Date("2026-01-01T00:00:00.000Z");
    expect(resolvePartnerStatusLabel("PENDING", calculatedAt, 14, new Date("2026-01-02T00:00:00.000Z"))).toBe(
      "PENDING",
    );
    expect(resolvePartnerStatusLabel("PENDING", calculatedAt, 14, new Date("2026-01-20T00:00:00.000Z"))).toBe(
      "ACTIVE",
    );
  });

  it("masks email when name is absent", () => {
    expect(safeReferredDisplayLabel({ email: "alex@example.com" })).toBe("al***@example.com");
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
    expect(partner).toContain("expectedPaidOutAt");
    expect(partner).toContain("ledgerStatus");
    expect(partner).toContain("markAffiliateReferralPaidOut");
    expect(fee).not.toMatch(/CommercialCoupon|applyCoupon/);
    expect(partner).not.toMatch(/CommercialCoupon|CouponRedemption/);
  });

  it("exposes partner balances, expected paid-out date, and absolute link", () => {
    const page = source("app/dashboard/partner/referrals/page.tsx");
    const dash = source("lib/affiliates/partner-referrals.ts");
    expect(page).toContain("getPartnerReferralDashboard");
    expect(dash).toContain("https://www.quantumreach.app");
    expect(page).toContain("CopyValueButton");
    expect(page).toContain("Expected paid out");
    expect(page).toContain("pendingTotalLabel");
    expect(page).toContain("availableTotalLabel");
    expect(page).toContain("paidTotalLabel");
    expect(page).toContain("DEFAULT_HOLD_DAYS");
    expect(page).toContain("readOnly");
  });

  it("exposes operator balances and manual mark-paid without Stripe Connect", () => {
    const page = source("app/platform/payouts/page.tsx");
    const actions = source("app/platform/payouts/actions.ts");
    const schema = source("prisma/schema.prisma");
    expect(page).toContain("getPlatformAffiliateBalances");
    expect(page).toContain("Mark paid");
    expect(page).toContain("availableTotalLabel");
    expect(page).toMatch(/does not send bank|manual payout/i);
    expect(page).not.toContain("stripe.transfers.create");
    expect(actions).toContain("requireOperatorAccess");
    expect(actions).toContain("markAffiliateReferralPaidOut");
    expect(actions).toContain("AFFILIATE_MANUAL_PAYOUT_RECORDED");
    expect(schema).toContain("ledgerStatus");
    expect(schema).toContain("expectedPaidOutAt");
    expect(schema).toContain("paidOutAt");
  });

  it("exposes operator affiliate program settings", () => {
    const page = source("app/platform/affiliates/settings/page.tsx");
    const actions = source("app/platform/affiliates/settings/actions.ts");
    const config = source("lib/affiliates/program-config.ts");
    expect(page).toContain("firstPaymentRateBps");
    expect(page).toContain("setupFeesCommissionable");
    expect(page).toContain("holdDays");
    expect(actions).toContain("requireOperatorAccess");
    expect(config).toContain("DEFAULT_HOLD_DAYS");
  });
});
