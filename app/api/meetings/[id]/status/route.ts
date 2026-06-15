import { NextResponse } from "next/server";
import { authorizeMeetingJoin } from "@/lib/meetings/service";
import { safeMeetingError } from "@/lib/meetings/errors";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json() as { invitationToken?: string; displayName?: string };
    const { meeting } = await authorizeMeetingJoin({ meetingId: params.id, invitationToken: body.invitationToken, displayName: body.displayName });
    return NextResponse.json({ status: meeting.status, endedAt: meeting.endedAt });
  } catch (error) {
    const message = safeMeetingError(error, "Meeting status is unavailable.");
    if (message === "This meeting is no longer joinable.") return NextResponse.json({ status: "ENDED" });
    return NextResponse.json({ error: message }, { status: message === "Meeting not found." ? 404 : 403 });
  }
}
