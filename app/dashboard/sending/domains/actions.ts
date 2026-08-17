"use server";

import { revalidatePath } from "next/cache";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { addByoDomain, verifyByoDomain } from "@/lib/sending-infrastructure/byo-domain";

export async function addByoDomainAction(form: FormData) {
  const { workspace, user } = await requireSubscriberWorkspaceAccess();
  await addByoDomain({
    workspaceId: workspace.id,
    actorUserId: user.id,
    domainName: String(form.get("domain") ?? ""),
  });
  revalidatePath("/dashboard/sending/domains");
  revalidatePath("/dashboard/onboarding");
}

export async function verifyByoDomainAction(form: FormData) {
  const { workspace, user } = await requireSubscriberWorkspaceAccess();
  await verifyByoDomain({
    workspaceId: workspace.id,
    domainId: String(form.get("domainId") ?? ""),
    actorUserId: user.id,
  });
  revalidatePath("/dashboard/sending/domains");
  revalidatePath("/dashboard/onboarding");
}
