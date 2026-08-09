import { prisma } from "@/lib/db/prisma";
import {
  calculateExpectedReferralFee,
  moneyCents,
  resolvePartnerStatusLabel,
  safeReferredDisplayLabel,
} from "@/lib/affiliates/expected-fee";
import { getAffiliateProgramConfig } from "@/lib/affiliates/program-config";

/**
 * After paid/simulated-paid fulfillment, mark the locked referral as partner-visible
 * with an expected fee. Complimentary and self-referrals never create commissionable rows.
 * Idempotent on feeCalculatedAt.
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
  const fee = calculateExpectedReferralFee(order, config);

  const attribution = await prisma.affiliateReferralAttribution.findUnique({
    where: { id: order.affiliateAttributionId },
    include: { membershipPeriod: { include: { participant: true } } },
  });
  if (!attribution) return null;
  if (attribution.status === "INVALIDATED") return null;

  // Self-referral: block partner visibility.
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
        expectedFeeCents: 0,
      },
    });
    await prisma.customerOrder.update({
      where: { id: order.id },
      data: { affiliateAttributionId: null },
    });
    return null;
  }

  if (order.paymentMethod === "COMPLIMENTARY" || !fee.commissionable || !config.enabled) {
    // Keep attribution locked for integrity, but not partner-commissionable.
    return prisma.affiliateReferralAttribution.update({
      where: { id: attribution.id },
      data: {
        status: attribution.status === "LOCKED" ? "LOCKED" : "LOCKED",
        lockedAt: attribution.lockedAt ?? new Date(),
        orderId: order.id,
        customerUserId: order.userId,
        workspaceId: order.workspaceId,
        partnerVisible: false,
        commissionable: false,
        partnerStatus: "VOID",
        expectedFeeCents: 0,
        firstPaymentGrossCents: 0,
        rateBpsSnapshot: fee.rateBps,
        packageKey: fee.packageKey,
        packageName: fee.packageName,
        feeCalculatedAt: attribution.feeCalculatedAt ?? new Date(),
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

  const partnerStatus = config.holdDays > 0 ? "PENDING" : "ACTIVE";

  return prisma.affiliateReferralAttribution.update({
    where: { id: attribution.id },
    data: {
      status: "LOCKED",
      lockedAt: attribution.lockedAt ?? new Date(),
      orderId: order.id,
      customerUserId: order.userId,
      workspaceId: order.workspaceId,
      partnerVisible: true,
      commissionable: true,
      partnerStatus,
      expectedFeeCents: fee.expectedFeeCents,
      firstPaymentGrossCents: fee.firstPaymentGrossCents,
      rateBpsSnapshot: fee.rateBps,
      packageKey: fee.packageKey,
      packageName: fee.packageName,
      referredDisplayLabel,
      feeCalculatedAt: new Date(),
      sourceMetadata: {
        ...(typeof attribution.sourceMetadata === "object" &&
        attribution.sourceMetadata &&
        !Array.isArray(attribution.sourceMetadata)
          ? (attribution.sourceMetadata as Record<string, unknown>)
          : {}),
        expectedFee: {
          rateBps: fee.rateBps,
          firstPaymentGrossCents: fee.firstPaymentGrossCents,
          setupIncludedCents: fee.setupIncludedCents,
          expectedFeeCents: fee.expectedFeeCents,
          recurringRateBps: fee.recurringRateBps,
          expectedRecurringFeeCents: fee.expectedRecurringFeeCents,
          paymentMethod: order.paymentMethod,
        },
      },
    },
  });
}

export type PartnerReferralRow = {
  id: string;
  date: Date;
  referredLabel: string;
  status: "PENDING" | "ACTIVE" | "CANCELED" | "VOID" | "CAPTURED";
  packageName: string | null;
  expectedFeeCents: number;
  expectedFeeLabel: string;
};

export type PartnerReferralDashboard = {
  code: string | null;
  referralLink: string | null;
  membershipStatus: string | null;
  programEnabled: boolean;
  rateLabel: string;
  holdDays: number;
  setupFeesCommissionable: boolean;
  rows: PartnerReferralRow[];
  referredCount: number;
  expectedFeesTotalCents: number;
  expectedFeesTotalLabel: string;
};

const REFERRAL_PUBLIC_ORIGIN = "https://www.quantumreach.app";

/** Ownership-scoped partner view of visible referrals and expected fees. */
export async function getPartnerReferralDashboard(userId: string): Promise<PartnerReferralDashboard> {
  const config = await getAffiliateProgramConfig();
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

  // Include referrals from all periods owned by this participant (historical periods too).
  const allReferrals = (participant?.memberships ?? []).flatMap((m) => m.referrals);
  const rows: PartnerReferralRow[] = allReferrals
    .filter((r) => r.partnerVisible)
    .map((r) => {
      const status = resolvePartnerStatusLabel(r.partnerStatus, r.feeCalculatedAt, config.holdDays);
      const fee = r.expectedFeeCents ?? 0;
      return {
        id: r.id,
        date: r.feeCalculatedAt ?? r.lockedAt ?? r.capturedAt,
        referredLabel: r.referredDisplayLabel ?? "Referred customer",
        status,
        packageName: r.packageName,
        expectedFeeCents: fee,
        expectedFeeLabel: moneyCents(fee),
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const expectedFeesTotalCents = rows
    .filter((r) => r.status === "PENDING" || r.status === "ACTIVE")
    .reduce((sum, r) => sum + r.expectedFeeCents, 0);

  return {
    code,
    referralLink: code ? `${REFERRAL_PUBLIC_ORIGIN}/r/${code}` : null,
    membershipStatus: open?.status ?? null,
    programEnabled: config.enabled,
    rateLabel: `${(config.firstPaymentRateBps / 100).toFixed(config.firstPaymentRateBps % 100 === 0 ? 0 : 2)}% of first payment${
      config.setupFeesCommissionable ? " (including setup fees)" : " (package month only; setup excluded)"
    }`,
    holdDays: config.holdDays,
    setupFeesCommissionable: config.setupFeesCommissionable,
    rows,
    referredCount: rows.length,
    expectedFeesTotalCents,
    expectedFeesTotalLabel: moneyCents(expectedFeesTotalCents),
  };
}
