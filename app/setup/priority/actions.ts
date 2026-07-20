"use server";
import { redirect } from "next/navigation";
import { SetupPriority } from "@prisma/client";
import { requireUserProfile } from "@/lib/auth/rbac";
import { selectSetupPriority } from "@/lib/customer-journey/service";
import { trackFunnelEvent } from "@/lib/customer-journey/funnel";
export async function choosePriority(formData: FormData) { const user = await requireUserProfile(); const priority = String(formData.get("priority")) as SetupPriority; const order = await selectSetupPriority(user.id, priority); await trackFunnelEvent("PRIORITY_SELECTED", { userId: user.id, customerOrderId: order.customerOrderId, metadata: { priority } }); redirect("/setup/confirmation"); }
