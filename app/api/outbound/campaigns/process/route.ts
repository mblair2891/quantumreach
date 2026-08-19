import { NextResponse } from "next/server";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { prisma } from "@/lib/db/prisma";
import { processCampaignBatch } from "@/lib/outbound/campaigns";

export async function POST(req: Request) {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  const body = await req.json().catch(() => ({}));
  if (typeof body.campaignId !== "string") {
    return NextResponse.json({ error: "campaignId is required." }, { status: 400 });
  }
  const campaign = await prisma.outboundCampaign.findFirst({
    where: { id: body.campaignId, workspaceId: workspace.id },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign was not found." }, { status: 404 });
  try {
    const result = await processCampaignBatch(campaign.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not process campaign." }, { status: 422 });
  }
}
