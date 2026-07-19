"use server";

import { revalidatePath } from "next/cache";
import { requireOperatorAccess } from "@/lib/admin/operator";
import { bootstrapOperatorWorkspace } from "@/lib/platform/workspaces";

export async function createMyWorkspaceAction() {
  const { user } = await requireOperatorAccess();
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email.split("@")[0] || "Operator";
  await bootstrapOperatorWorkspace(user.id, `${name} Workspace`);
  revalidatePath("/platform/workspaces");
  revalidatePath("/dashboard");
}
