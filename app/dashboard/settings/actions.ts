"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { requireWorkspaceAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";

export async function saveSendingIdentityAction(form: FormData) {
  const { workspace } = await requireWorkspaceAdmin();
  const legalName = String(form.get("legalName") ?? "").trim();
  const physicalMailingAddress = String(form.get("physicalMailingAddress") ?? "").trim();
  try {
    if (!physicalMailingAddress) throw new Error("A physical mailing address is required for Instantly campaigns.");
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { legalName: legalName || null, physicalMailingAddress },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`/dashboard/settings?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not save mailing identity.")}`);
  }
  redirect("/dashboard/settings?saved=identity");
}
