"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { removeAppliedCoupon } from "@/lib/commercial/coupons";
import { getDraftSession, readDraft, saveDraftSelection } from "@/lib/customer-journey/acquisition-draft";

export async function chooseInfrastructure(formData:FormData) {
  const session = await getDraftSession();
  if (!session || !readDraft(session.metadata).coreProductId) redirect("/start");
  const product = await prisma.commerceProduct.findFirst({ where: { id: String(formData.get("productId") ?? ""), category: "SENDING_PACKAGE", active: true } });
  if (!product) throw new Error("That infrastructure package is no longer available.");
  await removeAppliedCoupon(session.id);
  await saveDraftSelection({ infrastructureProductId: product.id });
  redirect("/setup/priority");
}
