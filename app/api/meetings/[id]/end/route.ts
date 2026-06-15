import { NextResponse } from "next/server";
import { authorizeMeetingJoin, endMeeting } from "@/lib/meetings/service";
import { safeMeetingError } from "@/lib/meetings/errors";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json() as { displayName?: string };
    const authorization = await authorizeMeetingJoin({ meetingId: params.id, displayName: body.displayName });
    await endMeeting(authorization);
    return NextResponse.json({ ok: true, status: "ENDED" });
  } catch (error) {
    const message = safeMeetingError(error, "The meeting could not be ended.");
    return NextResponse.json({ error: message }, { status: message === "Meeting not found." ? 404 : 403 });
  }
}
