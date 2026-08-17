"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { addByoDomain, verifyByoDomain } from "@/lib/sending-infrastructure/byo-domain";
import { createDomainPurchaseRequest } from "@/lib/managed-domains/purchase";

function fail(message: string): never {
  redirect(`/dashboard/sending/domains?error=${encodeURIComponent(message)}`);
}

export async function addByoDomainAction(form: FormData) {
  const { workspace, user } = await requireSubscriberWorkspaceAccess();
  try {
    await addByoDomain({
      workspaceId: workspace.id,
      actorUserId: user.id,
      domainName: String(form.get("domain") ?? ""),
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(error instanceof Error ? error.message : "Could not connect that domain.");
  }
  revalidatePath("/dashboard/sending/domains");
  revalidatePath("/dashboard/onboarding");
  redirect("/dashboard/sending/domains?connected=1");
}

export async function verifyByoDomainAction(form: FormData) {
  const { workspace, user } = await requireSubscriberWorkspaceAccess();
  try {
    const result = await verifyByoDomain({
      workspaceId: workspace.id,
      domainId: String(form.get("domainId") ?? ""),
      actorUserId: user.id,
    });
    revalidatePath("/dashboard/sending/domains");
    revalidatePath("/dashboard/onboarding");
    if (!result.verified) {
      fail(result.reason || "DNS is not verified yet. Publish the records and try again.");
    }
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(error instanceof Error ? error.message : "Could not verify DNS.");
  }
  redirect("/dashboard/sending/domains?verified=1");
}

export async function requestManagedDomainAction(form: FormData) {
  const { workspace, user } = await requireSubscriberWorkspaceAccess();
  try {
    await createDomainPurchaseRequest({
      workspaceId: workspace.id,
      requestedByUserId: user.id,
      requestedDomain: String(form.get("domain") ?? "").trim().toLowerCase(),
      ownershipType: "WORKSPACE_OWNED",
      registrantAttestationAccepted: String(form.get("attestation") ?? "") === "on",
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const raw = error instanceof Error ? error.message : "Could not submit that request.";
    fail(
      raw.includes("Registrant")
        ? "Complete and confirm your registrant profile first, then request a managed domain."
        : raw,
    );
  }
  revalidatePath("/dashboard/sending/domains");
  redirect("/dashboard/sending/domains?requested=1");
}
