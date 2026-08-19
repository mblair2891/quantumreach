"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import {
  createOutreachCampaign,
  pauseOutreachCampaign,
  processCampaignBatch,
  startOutreachCampaign,
} from "@/lib/outbound/campaigns";

function fail(path: string, message: string) {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createCampaignAction(form: FormData) {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  try {
    const campaign = await createOutreachCampaign({
      workspaceId: workspace.id,
      listId: String(form.get("listId") ?? ""),
      name: String(form.get("name") ?? ""),
      subject: String(form.get("subject") ?? ""),
      body: String(form.get("body") ?? ""),
      fromName: String(form.get("fromName") ?? ""),
    });
    redirect(`/dashboard/sending/outbound/campaigns/${campaign.id}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail("/dashboard/sending/outbound/campaigns", error instanceof Error ? error.message : "Could not create campaign.");
  }
}

export async function startCampaignAction(form: FormData) {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  const campaignId = String(form.get("campaignId") ?? "");
  try {
    await startOutreachCampaign(campaignId, workspace.id);
    await processCampaignBatch(campaignId);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(`/dashboard/sending/outbound/campaigns/${campaignId}`, error instanceof Error ? error.message : "Could not start campaign.");
  }
  redirect(`/dashboard/sending/outbound/campaigns/${campaignId}?ran=1`);
}

export async function pauseCampaignAction(form: FormData) {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  const campaignId = String(form.get("campaignId") ?? "");
  try {
    await pauseOutreachCampaign(campaignId, workspace.id);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(`/dashboard/sending/outbound/campaigns/${campaignId}`, error instanceof Error ? error.message : "Could not pause campaign.");
  }
  redirect(`/dashboard/sending/outbound/campaigns/${campaignId}`);
}

export async function processCampaignAction(form: FormData) {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  const campaignId = String(form.get("campaignId") ?? "");
  const campaign = await (await import("@/lib/db/prisma")).prisma.outboundCampaign.findFirst({
    where: { id: campaignId, workspaceId: workspace.id },
  });
  if (!campaign) fail("/dashboard/sending/outbound/campaigns", "Campaign was not found.");
  try {
    await processCampaignBatch(campaignId);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(`/dashboard/sending/outbound/campaigns/${campaignId}`, error instanceof Error ? error.message : "Could not process campaign.");
  }
  redirect(`/dashboard/sending/outbound/campaigns/${campaignId}?ran=1`);
}
