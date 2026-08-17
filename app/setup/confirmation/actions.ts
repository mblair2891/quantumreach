"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isRedirectError } from "next/dist/client/components/redirect";
import { applyCoupon, removeAppliedCoupon } from "@/lib/commercial/coupons";
import { buildAcquisitionChargeSummary } from "@/lib/commercial/charge-lines";
import { catalogPrice, loadValidatedDraft } from "@/lib/customer-journey/acquisition-draft";
import { createGuestAcquisitionOrder } from "@/lib/customer-journey/service";
import { getOptionalUserProfile } from "@/lib/auth/rbac";
import { getBillingConfig } from "@/lib/billing/config";
import { issueAccountSetupToken } from "@/lib/auth/account-setup";
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
    if (isRedirectError(error)) throw error;
    redirect(`/setup/confirmation?couponMessage=${encodeURIComponent(message(error))}`);
  }
}

export async function removeCouponAction() {
  const selected = await loadValidatedDraft();
  await removeAppliedCoupon(selected.session.id);
  revalidatePath("/setup/confirmation");
}

/** Pay-first: create unpaid guest order and start Stripe Checkout when billing is configured. */
export async function submitGuestCheckoutAction(form: FormData) {
  let orderId = "";
  let stripeUrl = "";
  try {
    if (String(form.get("agreementAccepted") ?? "") !== "on") {
      throw new Error("You must accept the terms to continue.");
    }
    const resume = String(form.get("resume") ?? "");
    const order = await createGuestAcquisitionOrder(resume, {
      email: String(form.get("email") ?? ""),
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      timezone: String(form.get("timezone") ?? "America/New_York"),
      country: String(form.get("country") ?? "US"),
      // Affiliate referral only — coupons use a separate form/action.
      referralCode: String(form.get("referralCode") ?? ""),
    });
    orderId = order.id;
    cookies().set("qr_acquisition", resume, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 60,
    });
    if (getBillingConfig().configured) {
      const user = await getOptionalUserProfile();
      const { createCheckout } = await import("@/lib/stripe/commerce");
      const session = await createCheckout(order.id, {
        id: user?.id ?? null,
        email: user?.email ?? null,
        acquisitionSessionId: order.acquisitionSessionId,
      });
      stripeUrl = session.url;
    }
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const detail = error instanceof Error ? error.message : "Could not submit order.";
    if (orderId) {
      redirect(`/setup/confirmation?submitted=1&orderId=${encodeURIComponent(orderId)}&checkoutError=${encodeURIComponent(detail)}`);
    }
    redirect(`/setup/confirmation?checkoutError=${encodeURIComponent(detail)}`);
  }
  // redirect() throws NEXT_REDIRECT — must stay outside catch so it is not treated as failure.
  if (stripeUrl) redirect(stripeUrl);
  redirect(`/setup/confirmation?submitted=1&orderId=${encodeURIComponent(orderId)}`);
}

export async function simulateSuccessfulPaymentAction(form: FormData) {
  assertSimulatedPaymentEnvironment();
  const orderId = String(form.get("orderId") ?? "");
  const user = await getOptionalUserProfile();
  let setupToken: string | null = null;
  let emailDelivery: string | null = null;
  try {
    const result = await simulateSuccessfulPayment({
      orderId,
      actorUserId: user?.id ?? null,
    });
    if (result.requiresAccountSetup && result.setup) {
      setupToken = result.setup.rawToken;
      emailDelivery = result.setup.emailDelivery;
    }
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`/setup/confirmation?submitted=1&orderId=${encodeURIComponent(orderId)}&testPayment=failed`);
  }
  if (setupToken && emailDelivery) {
    const params = new URLSearchParams({
      submitted: "1",
      orderId,
      testPayment: "completed",
      emailDelivery,
    });
    if (emailDelivery !== "SENT") {
      params.set("setupToken", setupToken);
    }
    redirect(`/setup/confirmation?${params.toString()}`);
  }
  redirect("/setup/status?testPayment=completed");
}

/** Re-issue the guest setup token and send (or fall back to an on-page link). */
export async function resendAccountSetupEmailAction(form: FormData) {
  const orderId = String(form.get("orderId") ?? "").trim();
  if (!orderId) redirect("/setup/confirmation");
  try {
    const issued = await issueAccountSetupToken(orderId);
    const params = new URLSearchParams({
      submitted: "1",
      orderId,
      emailDelivery: issued.emailDelivery,
    });
    if (issued.emailDelivery !== "SENT") {
      params.set("setupToken", issued.rawToken);
    }
    redirect(`/setup/confirmation?${params.toString()}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(
      `/setup/confirmation?submitted=1&orderId=${encodeURIComponent(orderId)}&checkoutError=${encodeURIComponent("Could not resend the setup email.")}`,
    );
  }
}
