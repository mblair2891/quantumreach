"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { addInbox, addSendingDomain, stubSend } from "@/lib/outbound/service";
import { createImportPreviewFromCsv } from "@/lib/revenue-os/imports";
import { disconnectGoogleInbox } from "@/lib/outbound/google-oauth";

function fail(message: string) {
  redirect(`/dashboard/sending/outbound?error=${encodeURIComponent(message)}`);
}

export async function addOutboundDomainAction(form: FormData) {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  try {
    await addSendingDomain({ workspaceId: workspace.id, hostname: String(form.get("hostname") ?? "") });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(error instanceof Error ? error.message : "Could not add sending domain.");
  }
  redirect("/dashboard/sending/outbound?added=domain");
}

export async function addOutboundInboxAction(form: FormData) {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  try {
    await addInbox({
      workspaceId: workspace.id,
      sendingDomainId: String(form.get("sendingDomainId") ?? ""),
      localPart: String(form.get("localPart") ?? ""),
      displayName: String(form.get("displayName") ?? ""),
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(error instanceof Error ? error.message : "Could not add inbox.");
  }
  redirect("/dashboard/sending/outbound?added=inbox");
}

export async function importOutboundContactsAction(form: FormData) {
  const { workspace, user } = await requireSubscriberWorkspaceAccess();
  try {
    const file = form.get("csv");
    const pasted = String(form.get("csvText") ?? "");
    const csv = file instanceof File && file.size > 0 ? await file.text() : pasted;
    const batch = await createImportPreviewFromCsv(workspace.id, csv, {
      fileName: file instanceof File && file.name ? file.name : "outbound.csv",
      listName: String(form.get("listName") ?? "Imported contacts").trim() || "Imported contacts",
      createdById: user.id,
    });
    redirect(`/dashboard/imports/${batch.id}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(error instanceof Error ? error.message : "Could not preview contacts.");
  }
}

export async function disconnectGoogleInboxAction(form: FormData) {
  const { workspace, user, membership } = await requireSubscriberWorkspaceAccess();
  if (!["WORKSPACE_OWNER", "ADMIN"].includes(String(membership.roleKey))) {
    fail("Workspace admin access is required to disconnect Google.");
  }
  try {
    await disconnectGoogleInbox(String(form.get("inboxId") ?? ""), workspace.id, user.id);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(error instanceof Error ? error.message : "Could not disconnect Google.");
  }
  redirect("/dashboard/sending/outbound?google=disconnected");
}

export async function stubOutboundSendAction(form: FormData) {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  const inboxId = String(form.get("inboxId") ?? "");
  const toEmail = String(form.get("toEmail") ?? "");
  try {
    const inbox = await (await import("@/lib/db/prisma")).prisma.inbox.findFirst({
      where: { id: inboxId, workspaceId: workspace.id },
    });
    if (!inbox) throw new Error("Inbox was not found.");
    const result = await stubSend({ inboxId, toEmail });
    if (!result.ok) fail(result.blockReason || "Send blocked.");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(error instanceof Error ? error.message : "Could not send.");
  }
  redirect("/dashboard/sending/outbound?sent=1");
}
