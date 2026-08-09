import type { Prisma } from "@prisma/client";
import type { AffiliateProgramConfigValues } from "@/lib/affiliates/program-config";

/** Narrow unknown/JSON values to plain objects for safe field access. */
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

function intCents(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function stringVal(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function productKeyFromMetadata(metadata: Prisma.JsonValue | null | undefined): string | null {
  const key = object(metadata).productKey;
  return typeof key === "string" ? key : null;
}

export type OrderEconomicsInput = {
  paymentMethod: string;
  paymentStatus: string;
  setupPriority?: string | null;
  acceptedCommercialTerms: Prisma.JsonValue | null;
  acceptedCouponSnapshot: Prisma.JsonValue | null;
  items?: Array<{ itemType: string; metadata: Prisma.JsonValue }>;
  purchaserEmail?: string | null;
  purchaserFirstName?: string | null;
  purchaserLastName?: string | null;
  businessName?: string | null;
};

export type ExpectedReferralFee = {
  commissionable: boolean;
  reason?: string;
  packageKey: string | null;
  packageName: string | null;
  firstPaymentGrossCents: number;
  setupIncludedCents: number;
  rateBps: number;
  expectedFeeCents: number;
  recurringRateBps: number;
  recurringMonthlyCents: number;
  expectedRecurringFeeCents: number;
};

/**
 * Pure expected-fee calculation for partner display.
 * Basis = first package month (+ setup fees when enabled by config).
 * Coupons reduce the first-month basis via percentageOff when present; setup remains separate.
 * Complimentary never commissionable.
 */
export function calculateExpectedReferralFee(
  order: OrderEconomicsInput,
  config: AffiliateProgramConfigValues,
): ExpectedReferralFee {
  const terms = object(order.acceptedCommercialTerms);
  const couponRoot = object(order.acceptedCouponSnapshot);
  const coupon = object(couponRoot.coupon);

  const packageKey =
    productKeyFromMetadata(order.items?.find((item) => item.itemType === "SENDING_PACKAGE")?.metadata ?? null) ??
    stringVal(terms.planKey) ??
    stringVal(terms.planSlug);

  const packageName = stringVal(terms.planName) ?? packageKey ?? "Package";
  const monthlyCents = intCents(terms.recurringPriceCents ?? terms.monthlyCents);
  const setupCents = intCents(terms.setupPriceCents ?? terms.setupCents);
  const prioritySurcharge =
    order.setupPriority === "PRIORITY" || order.setupPriority === "PRIORITY_SETUP" ? 25_000 : 0;

  if (order.paymentMethod === "COMPLIMENTARY") {
    return {
      commissionable: false,
      reason: "COMPLIMENTARY",
      packageKey,
      packageName,
      firstPaymentGrossCents: 0,
      setupIncludedCents: 0,
      rateBps: config.firstPaymentRateBps,
      expectedFeeCents: 0,
      recurringRateBps: config.recurringRateBps,
      recurringMonthlyCents: monthlyCents,
      expectedRecurringFeeCents: 0,
    };
  }

  if (!config.enabled) {
    return {
      commissionable: false,
      reason: "PROGRAM_DISABLED",
      packageKey,
      packageName,
      firstPaymentGrossCents: 0,
      setupIncludedCents: 0,
      rateBps: config.firstPaymentRateBps,
      expectedFeeCents: 0,
      recurringRateBps: config.recurringRateBps,
      recurringMonthlyCents: monthlyCents,
      expectedRecurringFeeCents: 0,
    };
  }

  if (order.paymentStatus !== "PAID") {
    return {
      commissionable: false,
      reason: "UNPAID",
      packageKey,
      packageName,
      firstPaymentGrossCents: 0,
      setupIncludedCents: 0,
      rateBps: config.firstPaymentRateBps,
      expectedFeeCents: 0,
      recurringRateBps: config.recurringRateBps,
      recurringMonthlyCents: monthlyCents,
      expectedRecurringFeeCents: 0,
    };
  }

  // First-month basis; apply promotional % off when snapshot has it.
  let firstMonthBasis = monthlyCents;
  const percentageOff = intCents(coupon.percentageOff);
  if (percentageOff > 0 && percentageOff <= 100) {
    firstMonthBasis = Math.floor((firstMonthBasis * (100 - percentageOff)) / 100);
  }

  const setupIncludedCents = config.setupFeesCommissionable ? setupCents + prioritySurcharge : 0;
  const firstPaymentGrossCents = firstMonthBasis + setupIncludedCents;
  const rateBps = Math.max(0, Math.min(10_000, config.firstPaymentRateBps));
  const expectedFeeCents = Math.floor((firstPaymentGrossCents * rateBps) / 10_000);
  const recurringRateBps = Math.max(0, Math.min(10_000, config.recurringRateBps));
  const expectedRecurringFeeCents = Math.floor((monthlyCents * recurringRateBps) / 10_000);

  return {
    commissionable: expectedFeeCents > 0 || firstPaymentGrossCents >= 0,
    packageKey,
    packageName,
    firstPaymentGrossCents,
    setupIncludedCents,
    rateBps,
    expectedFeeCents,
    recurringRateBps,
    recurringMonthlyCents: monthlyCents,
    expectedRecurringFeeCents,
  };
}

export type LedgerBalanceStatus = "PENDING" | "AVAILABLE" | "PAID";

/** activation/referral date + hold days → expected paid-out date. */
export function computeExpectedPaidOutAt(activationDate: Date, holdDays: number): Date {
  const days = Number.isFinite(holdDays) && holdDays >= 0 ? Math.floor(holdDays) : 14;
  const result = new Date(activationDate.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Internal balance status for commissionable referrals.
 * PAID is sticky (manual payout). Otherwise PENDING until expectedPaidOutAt, then AVAILABLE.
 */
export function resolveLedgerStatus(input: {
  ledgerStatus?: string | null;
  partnerStatus?: string | null;
  feeCalculatedAt?: Date | null;
  expectedPaidOutAt?: Date | null;
  paidOutAt?: Date | null;
  holdDays: number;
  now?: Date;
}): LedgerBalanceStatus {
  const now = input.now ?? new Date();
  if (input.paidOutAt || input.ledgerStatus === "PAID" || input.partnerStatus === "PAID") return "PAID";
  if (input.ledgerStatus === "AVAILABLE" || input.partnerStatus === "ACTIVE") {
    // Still respect paid-out date if set in the future (config change edge case).
    if (input.expectedPaidOutAt && input.expectedPaidOutAt.getTime() > now.getTime()) return "PENDING";
    return "AVAILABLE";
  }
  const paidOutAt =
    input.expectedPaidOutAt ??
    (input.feeCalculatedAt ? computeExpectedPaidOutAt(input.feeCalculatedAt, input.holdDays) : null);
  if (!paidOutAt) return "PENDING";
  if (paidOutAt.getTime() <= now.getTime()) return "AVAILABLE";
  return "PENDING";
}

/** @deprecated Prefer resolveLedgerStatus for money; maps AVAILABLE→ACTIVE for older UI labels. */
export function resolvePartnerStatusLabel(
  partnerStatus: string | null | undefined,
  feeCalculatedAt: Date | null | undefined,
  holdDays: number,
  now = new Date(),
): "PENDING" | "ACTIVE" | "CANCELED" | "VOID" | "CAPTURED" | "PAID" {
  if (partnerStatus === "CANCELED" || partnerStatus === "VOID" || partnerStatus === "PAID") return partnerStatus;
  const ledger = resolveLedgerStatus({
    partnerStatus,
    feeCalculatedAt,
    holdDays,
    now,
  });
  if (ledger === "PAID") return "PAID";
  if (ledger === "AVAILABLE") return "ACTIVE";
  if (!feeCalculatedAt && partnerStatus !== "PENDING") return "CAPTURED";
  return "PENDING";
}

export function formatDateOnly(date: Date) {
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function safeReferredDisplayLabel(input: {
  businessName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  purchaserFirstName?: string | null;
  purchaserLastName?: string | null;
  purchaserEmail?: string | null;
}): string {
  const business = input.businessName?.trim();
  if (business) return business;
  const first = (input.firstName ?? input.purchaserFirstName ?? "").trim();
  const last = (input.lastName ?? input.purchaserLastName ?? "").trim();
  const name = [first, last].filter(Boolean).join(" ");
  if (name) return name;
  const email = (input.email ?? input.purchaserEmail ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return "Referred customer";
  const [local, domain] = email.split("@");
  const maskedLocal = local.length <= 2 ? `${local[0] ?? "*"}*` : `${local.slice(0, 2)}***`;
  return `${maskedLocal}@${domain}`;
}

export function moneyCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);
}
