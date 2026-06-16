import { NextResponse } from "next/server";
import { createLiveKitAccessToken, getLiveKitUrl } from "@/lib/meetings/livekit";
import { authorizeMeetingJoin, recordTokenIssued } from "@/lib/meetings/service";
import { safeMeetingError } from "@/lib/meetings/errors";
import { assertRecordingConsentForToken } from "@/lib/meetings/recordings";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json() as { invitationToken?: string; displayName?: string };
    const authorization = await authorizeMeetingJoin({
      meetingId: params.id,
      invitationToken: body.invitationToken,
      displayName: body.displayName
    });
    const { meeting, participant, actorId } = authorization;
    await assertRecordingConsentForToken(meeting, participant, actorId);
    const token = createLiveKitAccessToken({
      roomName: meeting.roomName,
      identity: participant.identity,
      displayName: participant.displayName,
      role: participant.role
    });
    await recordTokenIssued(meeting.id, participant.id, actorId);
    return NextResponse.json({
      token,
      url: getLiveKitUrl(),
      identity: participant.identity,
      displayName: participant.displayName,
      role: participant.role,
      meeting: { id: meeting.id, title: meeting.title, status: "LIVE" }
    });
  } catch (error) {
    const message = safeMeetingError(error, "Meeting access could not be granted.");
    const status = message === "Meeting not found." ? 404 : message === "LiveKit configuration is unavailable." ? 503 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
