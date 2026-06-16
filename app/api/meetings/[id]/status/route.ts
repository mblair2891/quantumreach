import { NextResponse } from "next/server";
import { authorizeMeetingJoin } from "@/lib/meetings/service";
import { safeMeetingError } from "@/lib/meetings/errors";
import { getActiveRecordingForParticipant } from "@/lib/meetings/recordings";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json() as { invitationToken?: string; displayName?: string };
    const { meeting, participant } = await authorizeMeetingJoin({ meetingId: params.id, invitationToken: body.invitationToken, displayName: body.displayName });
    const recording = await getActiveRecordingForParticipant(meeting.id, participant.identity);
    return NextResponse.json({ status: meeting.status, endedAt: meeting.endedAt, recording: recording ? { id: recording.id, status: recording.status, consentStatus: recording.consents[0]?.consentStatus ?? "PENDING", transcriptionStatus: recording.transcriptionStatus } : null });
  } catch (error) {
    const message = safeMeetingError(error, "Meeting status is unavailable.");
    if (message === "This meeting is no longer joinable.") return NextResponse.json({ status: "ENDED" });
    return NextResponse.json({ error: message }, { status: message === "Meeting not found." ? 404 : 403 });
  }
}
