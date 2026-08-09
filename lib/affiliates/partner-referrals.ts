import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  calculateExpectedReferralFee,
  computeExpectedPaidOutAt,
  formatDateOnly,
  moneyCents,
  resolveLedgerStatus,
  safeReferredDisplayLabel,
  type LedgerBalanceStatus,
} from "@/lib/affiliates/expected-fee";
import { getAffiliateProgramConfig, resolveHoldDays } from "@/lib/affiliates/program-config";

/**
 * After paid/simulated-paid fulfillment, mark the locked referral as partner-visible
 * with an expected fee and ledger entry. Complimentary and self-referrals never create
 * commissionable balances. Idempotent on feeCalculatedAt.
 */
export async function recordPartnerReferralOnActivation(orderId: string) {
  const order = await prisma.customerOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order?.userId) return null;
  if (!order.affiliateAttributionId) return null;
  if (order.paymentStatus !== "PAID") return null;

  const config = await getAffiliateProgramConfig();
  const holdDays = resolveHoldDays(config.holdDays);
  const fee = calculateExpectedReferralFee(order, config);

  const attribution = await prisma.affiliateReferralAttribution.findUnique({
    where: { id: order.affiliateAttributionId },
    include: { membershipPeriod: { include: { participant: true } } },
  });
  if (!attribution) return null;
  if (attribution.status === "INVALIDATED") return null;

  // Self-referral: block partner visibility and ledger.
  if (attribution.membershipPeriod.participant.userId === order.userId) {
    await prisma.affiliateReferralAttribution.update({
      where: { id: attribution.id },
      data: {
        status: "INVALIDATED",
        invalidatedAt: new Date(),
        invalidationReason: "SELF_REFERRAL",
        partnerVisible: false,
        commissionable: false,
        partnerStatus: "VOID",
        ledgerStatus: null,
        expectedFeeCents: 0,
        expectedPaidOutAt: null,
      },
    });
    await prisma.customerOrder.update({
      where: { id: order.id },
      data: { affiliateAttributionId: null },
    });
    return null;
  }

  if (order.paymentMethod === "COMPLIMENTARY" || !fee.commissionable || !config.enabled) {
    return prisma.affiliateReferralAttribution.update({
      where: { id: attribution.id },
      data: {
        status: "LOCKED",
        lockedAt: attribution.lockedAt ?? new Date(),
        orderId: order.id,
        customerUserId: order.userId,
        workspaceId: order.workspaceId,
        partnerVisible: false,
        commissionable: false,
        partnerStatus: "VOID",
        ledgerStatus: null,
        expectedFeeCents: 0,
        firstPaymentGrossCents: 0,
        rateBpsSnapshot: fee.rateBps,
        packageKey: fee.packageKey,
        packageName: fee.packageName,
        feeCalculatedAt: attribution.feeCalculatedAt ?? new Date(),
        expectedPaidOutAt: null,
        referredDisplayLabel:
          attribution.referredDisplayLabel ??
          safeReferredDisplayLabel({
            purchaserEmail: order.purchaserEmail,
            purchaserFirstName: order.purchaserFirstName,
            purchaserLastName: order.purchaserLastName,
            businessName: order.businessName,
          }),
      },
    });
  }

  if (attribution.feeCalculatedAt && attribution.partnerVisible) {
    return attribution;
  }

  const referred = await prisma.userProfile.findUnique({ where: { id: order.userId } });
  const referredDisplayLabel = safeReferredDisplayLabel({
    businessName: order.businessName,
    firstName: referred?.firstName,
    lastName: referred?.lastName,
    email: referred?.email,
    purchaserFirstName: order.purchaserFirstName,
    purchaserLastName: order.purchaserLastName,
    purchaserEmail: order.purchaserEmail,
  });

  const activationDate = new Date();
  const expectedPaidOutAt = computeExpectedPaidOutAt(activationDate, holdDays);
  const ledgerStatus: LedgerBalanceStatus = holdDays > 0 ? "PENDING" : "AVAILABLE";
  const partnerStatus = ledgerStatus === "AVAILABLE" ? "ACTIVE" : "PENDING";

  return prisma.affiliateReferralAttribution.update({
    where: { id: attribution.id },
    data: {
      status: "LOCKED",
      lockedAt: attribution.lockedAt ?? activationDate,
      orderId: order.id,
      customerUserId: order.userId,
      workspaceId: order.workspaceId,
      partnerVisible: true,
      commissionable: true,
      partnerStatus,
      ledgerStatus,
      expectedFeeCents: fee.expectedFeeCents,
      firstPaymentGrossCents: fee.firstPaymentGrossCents,
      rateBpsSnapshot: fee.rateBps,
      packageKey: fee.packageKey,
      packageName: fee.packageName,
      referredDisplayLabel,
      feeCalculatedAt: activationDate,
      expectedPaidOutAt,
      sourceMetadata: {
        ...(typeof attribution.sourceMetadata === "object" &&
        attribution.sourceMetadata &&
        !Array.isArray(attribution.sourceMetadata)
          ? (attribution.sourceMetadata as Record<string, string | number | boolean | null>)
          : {}),
        expectedFee: {
          rateBps: fee.rateBps,
          firstPaymentGrossCents: fee.firstPaymentGrossCents,
          setupIncludedCents: fee.setupIncludedCents,
          expectedFeeCents: fee.expectedFeeCents,
          recurringRateBps: fee.recurringRateBps,
          expectedRecurringFeeCents: fee.expectedRecurringFeeCents,
          paymentMethod: order.paymentMethod,
          holdDays,
          expectedPaidOutAt: expectedPaidOutAt.toISOString(),
        },
      } as Prisma.InputJsonValue,
    },
  });
}

/** Promote PENDING → AVAILABLE when hold has elapsed (lazy, idempotent). Never touches PAID. */
export async function promoteEligibleAffiliateBalances(now = new Date()) {
  const due = await prisma.affiliateReferralAttribution.findMany({
    where: {
      partnerVisible: true,
      commissionable: true,
      paidOutAt: null,
      OR: [
        { ledgerStatus: "PENDING" },
        { ledgerStatus: null, partnerStatus: "PENDING" },
      ],
      expectedPaidOutAt: { lte: now },
    },
    select: { id: true },
    take: 500,
  });
  if (!due.length) return 0;
  await prisma.affiliateReferralAttribution.updateMany({
    where: { id: { in: due.map((row) => row.id) } },
    data: { ledgerStatus: "AVAILABLE", partnerStatus: "ACTIVE" },
  });
  return due.length;
}

export type PartnerReferralRow = {
  id: string;
  date: Date;
  referredLabel: string;
  status: LedgerBalanceStatus;
  statusLabel: string;
  packageName: string | null;
  expectedFeeCents: number;
  expectedFeeLabel: string;
  expectedPaidOutAt: Date | null;
  expectedPaidOutLabel: string;
};

export type PartnerReferralDashboard = {
  code: string | null;
  referralLink: string | null;
  membershipStatus: string | null;
  programEnabled: boolean;
  rateLabel: string;
  holdDays: number;
  holdDaysSource: "configured" | "default";
  setupFeesCommissionable: boolean;
  rows: PartnerReferralRow[];
  referredCount: number;
  pendingTotalCents: number;
  availableTotalCents: number;
  paidTotalCents: number;
  pendingTotalLabel: string;
  availableTotalLabel: string;
  paidTotalLabel: string;
  expectedFeesTotalCents: number;
  expectedFeesTotalLabel: string;
};

const REFERRAL_PUBLIC_ORIGIN = "https://www.quantumreach.app";

function statusLabel(status: LedgerBalanceStatus): string {
  if (status === "AVAILABLE") return "Available";
  if (status === "PAID") return "Paid";
  return "Pending";
}

/** Ownership-scoped partner view of referrals, expected paid-out dates, and balances. */
export async function getPartnerReferralDashboard(userId: string): Promise<PartnerReferralDashboard> {
  await promoteEligibleAffiliateBalances().catch(() => 0);
  const config = await getAffiliateProgramConfig();
  const holdDays = resolveHoldDays(config.holdDays);

  const participant = await prisma.affiliateParticipant.findUnique({
    where: { userId },
    include: {
      memberships: {
        orderBy: { startedAt: "desc" },
        include: {
          code: true,
          referrals: {
            where: { partnerVisible: true },
            orderBy: { capturedAt: "desc" },
            take: 100,
          },
        },
      },
    },
  });

  const open = participant?.memberships.find((m) => m.status === "ACTIVE" || m.status === "SUSPENDED");
  const code =
    open?.status === "ACTIVE" && open.code?.status === "ACTIVE" ? open.code.code : open?.code?.code ?? null;

  const allReferrals = (participant?.memberships ?? []).flatMap((m) => m.referrals);
  const rows: PartnerReferralRow[] = allReferrals
    .filter((r) => r.partnerVisible)
    .map((r) => {
      const activation = r.feeCalculatedAt ?? r.lockedAt ?? r.capturedAt;
      const expectedPaidOutAt =
        r.expectedPaidOutAt ?? (activation ? computeExpectedPaidOutAt(activation, holdDays) : null);
      const status = resolveLedgerStatus({
        ledgerStatus: r.ledgerStatus,
        partnerStatus: r.partnerStatus,
        feeCalculatedAt: r.feeCalculatedAt,
        expectedPaidOutAt,
        paidOutAt: r.paidOutAt,
        holdDays,
      });
      const fee = r.expectedFeeCents ?? 0;
      return {
        id: r.id,
        date: activation,
        referredLabel: r.referredDisplayLabel ?? "Referred customer",
        status,
        statusLabel: statusLabel(status),
        packageName: r.packageName,
        expectedFeeCents: fee,
        expectedFeeLabel: moneyCents(fee),
        expectedPaidOutAt,
        expectedPaidOutLabel: expectedPaidOutAt ? formatDateOnly(expectedPaidOutAt) : "—",
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const pendingTotalCents = rows.filter((r) => r.status === "PENDING").reduce((s, r) => s + r.expectedFeeCents, 0);
  const availableTotalCents = rows.filter((r) => r.status === "AVAILABLE").reduce((s, r) => s + r.expectedFeeCents, 0);
  const paidTotalCents = rows.filter((r) => r.status === "PAID").reduce((s, r) => s + r.expectedFeeCents, 0);

  return {
    code,
    referralLink: code ? `${REFERRAL_PUBLIC_ORIGIN}/r/${code}` : null,
    membershipStatus: open?.status ?? null,
    programEnabled: config.enabled,
    rateLabel: `${(config.firstPaymentRateBps / 100).toFixed(config.firstPaymentRateBps % 100 === 0 ? 0 : 2)}% of first payment${
      config.setupFeesCommissionable ? " (including setup fees)" : " (package month only; setup excluded)"
    }`,
    holdDays,
    holdDaysSource: config.holdDays === holdDays ? "configured" : "default",
    setupFeesCommissionable: config.setupFeesCommissionable,
    rows,
    referredCount: rows.length,
    pendingTotalCents,
    availableTotalCents,
    paidTotalCents,
    pendingTotalLabel: moneyCents(pendingTotalCents),
    availableTotalLabel: moneyCents(availableTotalCents),
    paidTotalLabel: moneyCents(paidTotalCents),
    expectedFeesTotalCents: pendingTotalCents + availableTotalCents,
    expectedFeesTotalLabel: moneyCents(pendingTotalCents + availableTotalCents),
  };
}

export type PlatformAffiliateBalanceRow = {
  id: string;
  affiliateName: string;
  affiliateEmail: string;
  referredLabel: string;
  packageName: string | null;
  expectedFeeCents: number;
  expectedFeeLabel: string;
  status: LedgerBalanceStatus;
  statusLabel: string;
  activationDate: Date;
  expectedPaidOutAt: Date | null;
  expectedPaidOutLabel: string;
  paidOutAt: Date | null;
  canMarkPaid: boolean;
};

export type PlatformAffiliateBalances = {
  holdDays: number;
  pendingTotalCents: number;
  availableTotalCents: number;
  paidTotalCents: number;
  pendingTotalLabel: string;
  availableTotalLabel: string;
  paidTotalLabel: string;
  owedTotalLabel: string;
  rows: PlatformAffiliateBalanceRow[];
};

/** Operator view: internal balances owed to affiliates (not bank transfers). */
export async function getPlatformAffiliateBalances(): Promise<PlatformAffiliateBalances> {
  await promoteEligibleAffiliateBalances().catch(() => 0);
  const config = await getAffiliateProgramConfig();
  const holdDays = resolveHoldDays(config.holdDays);

  const referrals = await prisma.affiliateReferralAttribution.findMany({
    where: { partnerVisible: true, commissionable: true },
    include: {
      membershipPeriod: { include: { participant: true } },
    },
    orderBy: { feeCalculatedAt: "desc" },
    take: 200,
  });

  const rows: PlatformAffiliateBalanceRow[] = referrals.map((r) => {
    const activation = r.feeCalculatedAt ?? r.lockedAt ?? r.capturedAt;
    const expectedPaidOutAt =
      r.expectedPaidOutAt ?? (activation ? computeExpectedPaidOutAt(activation, holdDays) : null);
    const status = resolveLedgerStatus({
      ledgerStatus: r.ledgerStatus,
      partnerStatus: r.partnerStatus,
      feeCalculatedAt: r.feeCalculatedAt,
      expectedPaidOutAt,
      paidOutAt: r.paidOutAt,
      holdDays,
    });
    const fee = r.expectedFeeCents ?? 0;
    return {
      id: r.id,
      affiliateName: r.membershipPeriod.participant.displayName,
      affiliateEmail: r.membershipPeriod.participant.email,
      referredLabel: r.referredDisplayLabel ?? "Referred customer",
      packageName: r.packageName,
      expectedFeeCents: fee,
      expectedFeeLabel: moneyCents(fee),
      status,
      statusLabel: statusLabel(status),
      activationDate: activation,
      expectedPaidOutAt,
      expectedPaidOutLabel: expectedPaidOutAt ? formatDateOnly(expectedPaidOutAt) : "—",
      paidOutAt: r.paidOutAt,
      canMarkPaid: status === "AVAILABLE",
    };
  });

  const pendingTotalCents = rows.filter((r) => r.status === "PENDING").reduce((s, r) => s + r.expectedFeeCents, 0);
  const availableTotalCents = rows.filter((r) => r.status === "AVAILABLE").reduce((s, r) => s + r.expectedFeeCents, 0);
  const paidTotalCents = rows.filter((r) => r.status === "PAID").reduce((s, r) => s + r.expectedFeeCents, 0);

  return {
    holdDays,
    pendingTotalCents,
    availableTotalCents,
    paidTotalCents,
    pendingTotalLabel: moneyCents(pendingTotalCents),
    availableTotalLabel: moneyCents(availableTotalCents),
    paidTotalLabel: moneyCents(paidTotalCents),
    owedTotalLabel: moneyCents(availableTotalCents),
    rows,
  };
}

/**
 * Manual payout tracking only — does not move money.
 * Marks an AVAILABLE commissionable referral as PAID.
 */
export async function markAffiliateReferralPaidOut(input: {
  attributionId: string;
  operatorUserId: string;
  note?: string | null;
}) {
  const config = await getAffiliateProgramConfig();
  const holdDays = resolveHoldDays(config.holdDays);
  const row = await prisma.affiliateReferralAttribution.findUnique({
    where: { id: input.attributionId },
  });
  if (!row || !row.partnerVisible || !row.commissionable) {
    throw new Error("AFFILIATE_PAYOUT_NOT_FOUND");
  }
  if (row.paidOutAt || row.ledgerStatus === "PAID") {
    throw new Error("AFFILIATE_PAYOUT_ALREADY_PAID");
  }
  const expectedPaidOutAt =
    row.expectedPaidOutAt ??
    (row.feeCalculatedAt ? computeExpectedPaidOutAt(row.feeCalculatedAt, holdDays) : null);
  const status = resolveLedgerStatus({
    ledgerStatus: row.ledgerStatus,
    partnerStatus: row.partnerStatus,
    feeCalculatedAt: row.feeCalculatedAt,
    expectedPaidOutAt,
    paidOutAt: row.paidOutAt,
    holdDays,
  });
  if (status !== "AVAILABLE") {
    throw new Error("AFFILIATE_PAYOUT_NOT_AVAILABLE");
  }

  return prisma.affiliateReferralAttribution.update({
    where: { id: row.id },
    data: {
      ledgerStatus: "PAID",
      partnerStatus: "PAID",
      paidOutAt: new Date(),
      paidOutById: input.operatorUserId,
      paidOutNote: input.note?.trim() || "Manual payout recorded",
    },
  });
}
