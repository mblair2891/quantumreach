"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requireOperatorAccess } from "@/lib/admin/operator";
import { prisma } from "@/lib/db/prisma";
import { markAffiliateReferralPaidOut } from "@/lib/affiliates/partner-referrals";

const messages: Record<string, string> = {
  AFFILIATE_PAYOUT_NOT_FOUND: "That referral balance was not found or is not commissionable.",
  AFFILIATE_PAYOUT_ALREADY_PAID: "That balance is already marked paid.",
  AFFILIATE_PAYOUT_NOT_AVAILABLE: "Only Available balances can be marked paid (still in hold).",
};

export async function markAffiliatePayoutPaidAction(form: FormData) {
  const operator = await requireOperatorAccess();
  const attributionId = String(form.get("attributionId") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();
  if (!attributionId) {
    redirect(`/platform/payouts?error=${encodeURIComponent("Missing referral id.")}`);
  }
  try {
    const updated = await markAffiliateReferralPaidOut({
      attributionId,
      operatorUserId: operator.user.id,
      note: note || null,
    });
    await prisma.auditLog.create({
      data: {
        workspaceId: null,
        actorId: operator.user.id,
        action: "AFFILIATE_MANUAL_PAYOUT_RECORDED",
        entityType: "AffiliateReferralAttribution",
        entityId: updated.id,
        metadata: {
          scope: "PLATFORM",
          actorType: "PLATFORM_OPERATOR",
          correlationId: randomUUID(),
          expectedFeeCents: updated.expectedFeeCents,
          paidOutAt: updated.paidOutAt?.toISOString() ?? null,
          note: updated.paidOutNote,
        },
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "PAYOUT_FAILED";
    const message = messages[code] ?? (error instanceof Error ? error.message : "Could not mark paid.");
    redirect(`/platform/payouts?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/platform/payouts");
  revalidatePath("/dashboard/partner/referrals");
  redirect("/platform/payouts?message=" + encodeURIComponent("Manual payout recorded for that balance."));
}
