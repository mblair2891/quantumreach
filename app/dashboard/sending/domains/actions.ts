"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { addByoDomain, removeByoDomain, verifyByoDomain } from "@/lib/sending-infrastructure/byo-domain";
import {
  checkManagedDomainAvailability,
  formatRegistrarPrice,
  purchaseManagedDomainForWorkspace,
} from "@/lib/managed-domains/purchase";

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

export async function removeByoDomainAction(form: FormData) {
  const { workspace, user, membership } = await requireSubscriberWorkspaceAccess();
  try {
    await removeByoDomain({
      workspaceId: workspace.id,
      domainId: String(form.get("domainId") ?? ""),
      actorUserId: user.id,
      actorRoleKey: String(membership.roleKey),
      confirmName: String(form.get("confirmName") ?? ""),
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(error instanceof Error ? error.message : "Could not remove that domain.");
  }
  revalidatePath("/dashboard/sending/domains");
  revalidatePath("/dashboard/onboarding");
  revalidatePath("/dashboard/sending/mailboxes");
  revalidatePath("/dashboard/sending/senders");
  redirect("/dashboard/sending/domains?removed=1");
}

export async function checkManagedDomainAction(form: FormData) {
  try {
    await requireSubscriberWorkspaceAccess();
    const result = await checkManagedDomainAvailability(String(form.get("domain") ?? ""));
    const price = formatRegistrarPrice(result.estimatedCostCents);
    const params = new URLSearchParams({
      check: result.domainName,
      available: result.available ? "1" : "0",
    });
    if (price) params.set("price", price);
    if (!result.available) params.set("error", result.message || "That domain is not available.");
    redirect(`/dashboard/sending/domains?${params.toString()}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(error instanceof Error ? error.message : "Could not check that domain.");
  }
}

export async function purchaseManagedDomainAction(form: FormData) {
  const { workspace, user } = await requireSubscriberWorkspaceAccess();
  try {
    await purchaseManagedDomainForWorkspace({
      workspaceId: workspace.id,
      actorUserId: user.id,
      domainName: String(form.get("domain") ?? ""),
      registrantAttestationAccepted: String(form.get("attestation") ?? "") === "on",
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const raw = error instanceof Error ? error.message : "Could not register that domain.";
    fail(
      raw.includes("Registrant")
        ? "Complete and confirm your registrant profile first, then request a domain we’ll register for you."
        : raw,
    );
  }
  revalidatePath("/dashboard/sending/domains");
  revalidatePath("/dashboard/onboarding");
  redirect("/dashboard/sending/domains?purchased=1");
}
