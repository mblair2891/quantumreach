"use server";
import { redirect } from "next/navigation"; import { requireUserProfile } from "@/lib/auth/rbac"; import { createInfrastructureOrder } from "@/lib/customer-journey/service"; import { trackFunnelEvent } from "@/lib/customer-journey/funnel";
export async function chooseInfrastructure(formData:FormData){const user=await requireUserProfile();const result=await createInfrastructureOrder({userId:user.id,productKey:String(formData.get("productKey"))});await trackFunnelEvent("INFRASTRUCTURE_PACKAGE_SELECTED",{userId:user.id,customerOrderId:result.order.id});redirect("/setup/priority")}
