"use server";

import { revalidatePath } from "next/cache";
import { requireOperatorAccess } from "@/lib/admin/operator";
import { deleteTestSubscriberByEmail } from "@/lib/admin/delete-test-subscriber";

export async function deleteTestSubscriberAction(form: FormData): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  try {
    const { operatorEmail } = await requireOperatorAccess();
    const email = String(form.get("email") ?? "");
    const confirm = String(form.get("confirm") ?? "").trim().toLowerCase();
    if (confirm !== email.trim().toLowerCase()) {
      return { ok: false, error: "Type the exact email again to confirm deletion." };
    }
    const result = await deleteTestSubscriberByEmail(email, operatorEmail);
    revalidatePath("/platform/subscribers");
    return {
      ok: true,
      message: `Deleted test subscriber ${result.email}${result.workspaces.length ? ` and cleaned ${result.workspaces.length} owned workspace(s)` : ""}.`,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Delete failed." };
  }
}
