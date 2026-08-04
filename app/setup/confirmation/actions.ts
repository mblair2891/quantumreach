"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { applyCoupon, removeAppliedCoupon } from "@/lib/commercial/coupons";
import { buildAcquisitionChargeSummary } from "@/lib/commercial/charge-lines";
import { catalogPrice, loadValidatedDraft } from "@/lib/customer-journey/acquisition-draft";
import { requireUserProfile } from "@/lib/auth/rbac";
import { assertSimulatedPaymentEnvironment } from "@/lib/simulated-payment/environment";
import { simulateSuccessfulPayment } from "@/lib/simulated-payment/service";

const message=(error:unknown)=>error instanceof Error?error.message:"Code is invalid.";
export async function applyCouponAction(form:FormData){try{const selected=await loadValidatedDraft();const setup=catalogPrice(selected.setup);const key=selected.setup.key;if((key!=="STANDARD_SETUP"&&key!=="PRIORITY_SETUP")||!setup.configured)throw new Error("This code no longer applies to the selected order.");const summary=buildAcquisitionChargeSummary(selected.infrastructure.key,{productKey:key,displayName:selected.setup.name,amountCents:setup.oneTimeCents});await applyCoupon({acquisitionSessionId:selected.session.id,code:String(form.get("code")??""),summary,replace:String(form.get("replace"))==="true"});revalidatePath("/setup/confirmation");}catch(error){redirect(`/setup/confirmation?couponMessage=${encodeURIComponent(message(error))}`);}}
export async function removeCouponAction(){const selected=await loadValidatedDraft();await removeAppliedCoupon(selected.session.id);revalidatePath("/setup/confirmation");}

export async function simulateSuccessfulPaymentAction(form: FormData) {
  assertSimulatedPaymentEnvironment();
  const user = await requireUserProfile();
  const orderId = String(form.get("orderId") ?? "");
  try {
    await simulateSuccessfulPayment({ orderId, actorUserId: user.id });
  } catch {
    redirect("/setup/confirmation?submitted=1&testPayment=failed");
  }
  redirect("/setup/status?testPayment=completed");
}
