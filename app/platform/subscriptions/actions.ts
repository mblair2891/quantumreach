/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";
import { revalidatePath } from "next/cache";
import { requireOperatorAccess } from "@/lib/admin/operator";
import { assignWorkspaceCommerceProduct, deactivateManualWorkspaceCommerceItem } from "@/lib/commerce/manual-assignment";
function date(v: FormDataEntryValue | null) { const raw = String(v || ""); return raw ? new Date(raw) : null; }
export async function assignProductAction(form: FormData) { const ctx = await requireOperatorAccess(); await assignWorkspaceCommerceProduct({ workspaceId: String(form.get("workspaceId")), productId: String(form.get("productId")), quantity: Number(form.get("quantity")), source: String(form.get("source")) as any, startsAt: date(form.get("startsAt")), endsAt: date(form.get("endsAt")), note: String(form.get("note") || "") || null, assignedById: ctx.user.id }); revalidatePath("/platform/subscriptions"); revalidatePath("/platform/workspaces"); revalidatePath(`/platform/workspaces/${String(form.get("workspaceId"))}`); revalidatePath("/dashboard/sending"); }
export async function deactivateProductAction(form: FormData) { const ctx = await requireOperatorAccess(); await deactivateManualWorkspaceCommerceItem(String(form.get("itemId")), ctx.user.id); revalidatePath("/platform/subscriptions"); revalidatePath(`/platform/workspaces/${String(form.get("workspaceId"))}`); revalidatePath("/dashboard/sending"); }
