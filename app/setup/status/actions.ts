"use server"; import { revalidatePath } from "next/cache"; import { requireUserProfile } from "@/lib/auth/rbac"; import { completeCustomerTask } from "@/lib/customer-journey/service";
export async function completeTask(formData:FormData){const user=await requireUserProfile();await completeCustomerTask(user.id,String(formData.get("taskId")));revalidatePath("/setup/status")}
