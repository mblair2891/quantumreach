import { NextResponse } from "next/server";
import { getCurrentWorkspace } from "@/lib/workspaces/service";
import { getMeetingInvitationUrl } from "@/lib/meetings/service";

export async function POST(_request: Request, { params }: { params: { id: string; invitationId: string } }) {
  try {
    const workspace = await getCurrentWorkspace();
    if (!workspace) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = await getMeetingInvitationUrl(workspace.id, params.id, params.invitationId);
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate invitation link." }, { status: 400 });
  }
}
