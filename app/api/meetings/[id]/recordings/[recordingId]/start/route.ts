import { NextResponse } from "next/server";
import { startRecordingForMeeting, safeRecordingError } from "@/lib/meetings/recordings";

export const runtime = "nodejs";

function statusFor(message: string) {
  if (/host|co-host|authorized/i.test(message)) return 403;
  if (/consent/i.test(message)) return 409;
  if (/configuration|provider|LiveKit|Egress|recording service/i.test(message)) return 503;
  if (/not found/i.test(message)) return 404;
  return 400;
}

export async function POST(_request: Request, { params }: { params: { id: string; recordingId: string } }) {
  try {
    const recording = await startRecordingForMeeting(params.id, params.recordingId);
    return NextResponse.json({ ok: true, recording: { id: recording.id, status: recording.status } });
  } catch (error) {
    const message = safeRecordingError(error, "Recording could not be started.");
    return NextResponse.json({ ok: false, error: message }, { status: statusFor(message) });
  }
}
