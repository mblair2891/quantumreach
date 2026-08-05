"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { applyCoupon, removeAppliedCoupon } from "@/lib/commercial/coupons";
import { buildAcquisitionChargeSummary } from "@/lib/commercial/charge-lines";
import { catalogPrice, loadValidatedDraft } from "@/lib/customer-journey/acquisition-draft";
import { createGuestAcquisitionOrder } from "@/lib/customer-journey/service";
import { getOptionalUserProfile } from "@/lib/auth/rbac";
import { assertSimulatedPaymentEnvironment } from "@/lib/simulated-payment/environment";
import { simulateSuccessfulPayment } from "@/lib/simulated-payment/service";

const message = (error: unknown) => (error instanceof Error ? error.message : "Code is invalid.");

export async function applyCouponAction(form: FormData) {
  try {
    const selected = await loadValidatedDraft();
    const setup = catalogPrice(selected.setup);
    const key = selected.setup.key;
    if ((key !== "STANDARD_SETUP" && key !== "PRIORITY_SETUP") || !setup.configured) {
      throw new Error("This code no longer applies to the selected order.");
    }
    const summary = buildAcquisitionChargeSummary(selected.infrastructure.key, {
      productKey: key,
      displayName: selected.setup.name,
      amountCents: setup.oneTimeCents,
    });
    await applyCoupon({
      acquisitionSessionId: selected.session.id,
      code: String(form.get("code") ?? ""),
      summary,
      replace: String(form.get("replace")) === "true",
    });
    revalidatePath("/setup/confirmation");
  } catch (error) {
    redirect(`/setup/confirmation?couponMessage=${encodeURIComponent(message(error))}`);
  }
}

export async function removeCouponAction() {
  const selected = await loadValidatedDraft();
  await removeAppliedCoupon(selected.session.id);
  revalidatePath("/setup/confirmation");
}

/** Pay-first: create unpaid guest order and show payment step. */
export async function submitGuestCheckoutAction(form: FormData) {
  try {
    if (String(form.get("agreementAccepted") ?? "") !== "on") {
      throw new Error("You must accept the terms to continue.");
    }
    const resume = String(form.get("resume") ?? "");
    const order = await createGuestAcquisitionOrder(resume, {
      email: String(form.get("email") ?? ""),
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      businessName: String(form.get("businessName") ?? ""),
      timezone: String(form.get("timezone") ?? "America/New_York"),
      country: String(form.get("country") ?? "US"),
    });
    cookies().set("qr_acquisition", resume, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 60,
    });
    redirect(`/setup/confirmation?submitted=1&orderId=${encodeURIComponent(order.id)}`);
  } catch (error) {
    redirect(
      `/setup/confirmation?checkoutError=${encodeURIComponent(error instanceof Error ? error.message : "Could not submit order.")}`,
    );
  }
}

export async function simulateSuccessfulPaymentAction(form: FormData) {
  assertSimulatedPaymentEnvironment();
  const orderId = String(form.get("orderId") ?? "");
  const user = await getOptionalUserProfile();
  try {
    const result = await simulateSuccessfulPayment({
      orderId,
      actorUserId: user?.id ?? null,
    });
    if (result.requiresAccountSetup && result.setup) {
      // Pass raw token only via redirect query for Preview/local deep link (email deferred).
      redirect(
        `/setup/confirmation?submitted=1&orderId=${encodeURIComponent(orderId)}&testPayment=completed&setupToken=${encodeURIComponent(result.setup.rawToken)}`,
      );
    }
  } catch {
    redirect(`/setup/confirmation?submitted=1&orderId=${encodeURIComponent(orderId)}&testPayment=failed`);
  }
  redirect("/setup/status?testPayment=completed");
}
