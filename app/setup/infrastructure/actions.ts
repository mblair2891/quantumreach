"use server";
import { redirect } from "next/navigation"; import { requireUserProfile } from "@/lib/auth/rbac"; import { createInfrastructureOrder } from "@/lib/customer-journey/service"; import { SetupPriority } from "@prisma/client";
export async function chooseInfrastructure(formData:FormData){const user=await requireUserProfile();const priority=String(formData.get("priority")||"STANDARD") as SetupPriority; await createInfrastructureOrder({userId:user.id,productKey:String(formData.get("productKey")),priority});redirect("/setup/status")}
