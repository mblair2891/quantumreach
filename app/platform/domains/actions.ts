"use server";

import { revalidatePath } from "next/cache";
import { requireOperatorAccess } from "@/lib/admin/operator";
import { prisma } from "@/lib/db/prisma";
import { operatorForceDomainStatus, verifyByoDomain } from "@/lib/sending-infrastructure/byo-domain";
import { markDomainPurchaseFailed, retryDomainPurchaseRequest } from "@/lib/managed-domains/purchase";

export async function operatorRetryVerifyAction(form: FormData) {
  const operator = await requireOperatorAccess();
  const domainId = String(form.get("domainId") ?? "");
  const domain = await prisma.managedDomain.findUniqueOrThrow({ where: { id: domainId } });
  if (!domain.workspaceId) throw new Error("Domain is not attached to a workspace.");
  await verifyByoDomain({ workspaceId: domain.workspaceId, domainId, actorUserId: operator.user.id });
  revalidatePath("/platform/domains");
}

export async function operatorRetryPurchaseAction(form: FormData) {
  const operator = await requireOperatorAccess();
  await retryDomainPurchaseRequest(String(form.get("requestId") ?? ""), operator.user.id);
  revalidatePath("/platform/domains");
}

export async function operatorMarkPurchaseFailedAction(form: FormData) {
  const operator = await requireOperatorAccess();
  await markDomainPurchaseFailed(
    String(form.get("requestId") ?? ""),
    operator.user.id,
    String(form.get("note") ?? ""),
  );
  revalidatePath("/platform/domains");
}

export async function operatorForceDomainAction(form: FormData) {
  const operator = await requireOperatorAccess();
  await operatorForceDomainStatus({
    domainId: String(form.get("domainId") ?? ""),
    actorUserId: operator.user.id,
    verificationStatus: String(form.get("verificationStatus") ?? "PENDING") as "VERIFIED" | "PENDING" | "FAILED",
    dkimStatus: String(form.get("dkimStatus") ?? "PENDING") as "VERIFIED" | "PENDING" | "FAILED",
    note: String(form.get("note") ?? ""),
  });
  revalidatePath("/platform/domains");
}
