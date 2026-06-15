import { NextResponse } from "next/server";
import { authorizeMeetingJoin, recordMeetingLifecycle } from "@/lib/meetings/service";
import { safeMeetingError } from "@/lib/meetings/errors";

const allowed = new Set(["PARTICIPANT_JOINED", "PARTICIPANT_LEFT", "SCREEN_SHARE_STARTED", "SCREEN_SHARE_STOPPED"]);

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json() as { invitationToken?: string; displayName?: string; type?: string; eventId?: string };
    if (!body.type || !allowed.has(body.type)) return NextResponse.json({ error: "Unsupported meeting event." }, { status: 400 });
    const authorization = await authorizeMeetingJoin({ meetingId: params.id, invitationToken: body.invitationToken, displayName: body.displayName });
    await recordMeetingLifecycle(
      authorization,
      body.type as "PARTICIPANT_JOINED" | "PARTICIPANT_LEFT" | "SCREEN_SHARE_STARTED" | "SCREEN_SHARE_STOPPED",
      body.eventId
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = safeMeetingError(error, "The meeting event could not be recorded.");
    return NextResponse.json({ error: message }, { status: message === "Meeting not found." ? 404 : 403 });
  }
}
