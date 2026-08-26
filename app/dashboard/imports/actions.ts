"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { commitImportBatch, createImportPreviewFromCsv } from "@/lib/revenue-os/imports";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function previewImportAction(form: FormData) {
  const { workspace, user } = await requireSubscriberWorkspaceAccess();
  try {
    const file = form.get("csv");
    const pasted = String(form.get("csvText") ?? "");
    const csv = file instanceof File && file.size > 0 ? await file.text() : pasted;
    const fileName = file instanceof File && file.name ? file.name : "pasted.csv";
    const batch = await createImportPreviewFromCsv(workspace.id, csv, {
      fileName,
      listName: String(form.get("listName") ?? "").trim() || undefined,
      createdById: user.id,
    });
    redirect(`/dashboard/imports/${batch.id}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail("/dashboard/imports", error instanceof Error ? error.message : "Could not preview import.");
  }
}

export async function commitReadyImportAction(form: FormData) {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  const batchId = String(form.get("batchId") ?? "");
  const attested = String(form.get("complianceAttested") ?? "") === "on" || String(form.get("complianceAttested") ?? "") === "true";
  try {
    await commitImportBatch(workspace.id, batchId, attested, { readyOnly: true });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(`/dashboard/imports/${batchId}`, error instanceof Error ? error.message : "Could not import ready contacts.");
  }
  redirect(`/dashboard/imports/${batchId}?committed=1`);
}
