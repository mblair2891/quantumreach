"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requireOperatorAccess } from "@/lib/admin/operator";
import { prisma } from "@/lib/db/prisma";
import { updateAffiliateProgramConfig } from "@/lib/affiliates/program-config";

export async function updateAffiliateProgramSettingsAction(form: FormData) {
  const operator = await requireOperatorAccess();
  try {
    const firstPaymentRateBps = Number(form.get("firstPaymentRateBps"));
    const recurringRateBps = Number(form.get("recurringRateBps"));
    const holdDays = Number(form.get("holdDays"));
    if (![firstPaymentRateBps, recurringRateBps, holdDays].every((n) => Number.isFinite(n))) {
      throw new Error("Rates and hold days must be valid numbers.");
    }
    const updated = await updateAffiliateProgramConfig({
      enabled: String(form.get("enabled") ?? "") === "on",
      firstPaymentRateBps,
      recurringRateBps,
      setupFeesCommissionable: String(form.get("setupFeesCommissionable") ?? "") === "on",
      holdDays,
      notes: String(form.get("notes") ?? ""),
    });
    await prisma.auditLog.create({
      data: {
        workspaceId: null,
        actorId: operator.user.id,
        action: "AFFILIATE_PROGRAM_SETTINGS_UPDATED",
        entityType: "AffiliateProgramConfig",
        entityId: updated.id,
        metadata: {
          scope: "PLATFORM",
          actorType: "PLATFORM_OPERATOR",
          correlationId: randomUUID(),
          next: {
            enabled: updated.enabled,
            firstPaymentRateBps: updated.firstPaymentRateBps,
            recurringRateBps: updated.recurringRateBps,
            setupFeesCommissionable: updated.setupFeesCommissionable,
            holdDays: updated.holdDays,
          },
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save settings.";
    redirect(`/platform/affiliates/settings?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/platform/affiliates/settings");
  revalidatePath("/dashboard/partner/referrals");
  redirect("/platform/affiliates/settings?saved=1");
}
