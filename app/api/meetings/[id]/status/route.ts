import { NextResponse } from "next/server";
import { authorizeMeetingJoin } from "@/lib/meetings/service";
import { safeMeetingError } from "@/lib/meetings/errors";
import { getRecordingRoomStatus } from "@/lib/meetings/recordings";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json() as { invitationToken?: string; displayName?: string };
    const authorization = await authorizeMeetingJoin({ meetingId: params.id, invitationToken: body.invitationToken, displayName: body.displayName });
    const status = await getRecordingRoomStatus(authorization);
    return NextResponse.json({ status: authorization.meeting.status, endedAt: authorization.meeting.endedAt, ...status });
  } catch (error) {
    const message = safeMeetingError(error, "Meeting status is unavailable.");
    if (message === "This meeting is no longer joinable.") return NextResponse.json({ status: "ENDED" });
    return NextResponse.json({ error: message }, { status: message === "Meeting not found." ? 404 : 403 });
  }
}
