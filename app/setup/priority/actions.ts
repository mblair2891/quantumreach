"use server";
import { redirect } from "next/navigation";
import { CustomerSetupPriority, getDraftSession, readDraft, saveDraftSelection, setupProductKeys } from "@/lib/customer-journey/acquisition-draft";
import { prisma } from "@/lib/db/prisma";
import { removeAppliedCoupon } from "@/lib/commercial/coupons";
export async function choosePriority(formData: FormData) {
  const session = await getDraftSession(); const draft = session ? readDraft(session.metadata) : {};
  if (!draft.coreProductId || !draft.infrastructureProductId) redirect("/setup/infrastructure");
  const priority = String(formData.get("priority")) as CustomerSetupPriority;
  if (!(priority in setupProductKeys)) throw new Error("That setup priority is not available.");
  const product = await prisma.commerceProduct.findFirst({ where: { key: setupProductKeys[priority], category: "SETUP_FEE", active: true } });
  if (!product) throw new Error("That setup priority is not currently available.");
  if (session) await removeAppliedCoupon(session.id);
  await saveDraftSelection({ setupPriority: priority });
  redirect("/setup/confirmation");
}
