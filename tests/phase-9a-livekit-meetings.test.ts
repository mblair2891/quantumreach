import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const source = (path: string) => readFileSync(path, "utf8");
const require = createRequire(import.meta.url);

describe("Phase 9A LiveKit meetings", () => {
  it("resolves all required LiveKit browser packages", () => {
    expect(require.resolve("livekit-client")).toBeTruthy();
    expect(require.resolve("@livekit/components-react")).toBeTruthy();
    expect(require.resolve("@livekit/components-styles")).toBeTruthy();
  });

  it("keeps credentials server-only and issues room-scoped short-lived grants", () => {
    const livekit = source("lib/meetings/livekit.ts");
    const client = source("components/meetings/meeting-client.tsx");
    expect(livekit).toContain('import "server-only"');
    expect(livekit).toContain('required("LIVEKIT_API_SECRET")');
    expect(livekit).toContain("exp: now + 15 * 60");
    expect(livekit).toContain("room: input.roomName");
    expect(livekit).toContain("roomJoin: true");
    expect(livekit).toContain("canSubscribe: true");
    expect(livekit).toContain("canPublish: true");
    expect(livekit).toContain('input.role === "HOST" || input.role === "CO_HOST"');
    expect(client).not.toContain("LIVEKIT_API_SECRET");
    expect(client).not.toContain("LIVEKIT_API_KEY");
  });

  it("derives room, role, identity, and workspace authority on the server", () => {
    const service = source("lib/meetings/service.ts");
    const tokenRoute = source("app/api/meetings/[id]/token/route.ts");
    expect(tokenRoute).toContain("authorizeMeetingJoin");
    expect(tokenRoute).toContain("roomName: meeting.roomName");
    expect(tokenRoute).toContain("identity: participant.identity");
    expect(tokenRoute).not.toContain("body.roomName");
    expect(tokenRoute).not.toContain("body.role");
    expect(tokenRoute).not.toContain("body.identity");
    expect(service).toContain("workspaceMember.findFirst");
    expect(service).toContain("meeting.hostId === user.id");
    expect(service).toContain("participantIdentity(meeting.id");
  });

  it("hashes, expires, revokes, and meeting-scopes guest invitations", () => {
    const service = source("lib/meetings/service.ts");
    expect(service).toContain('createHash("sha256").update(token).digest("hex")');
    expect(service).toContain("findValidInvitation(meeting.id, invitationToken)");
    expect(source("lib/meetings/invitations.ts")).toContain("createHmac");
    expect(service).toContain("if (invitation.revokedAt)");
    expect(service).toContain("invitation.expiresAt <= new Date()");
    expect(service).toContain("parseGuestRole");
    expect(source("middleware.ts")).toContain('"/dashboard(.*)"');
  });

  it("connects with LiveKitRoom and handles actual room connection states", () => {
    const client = source("components/meetings/meeting-client.tsx");
    expect(client).toContain("<LiveKitRoom");
    expect(client).toContain("serverUrl={access.url}");
    expect(client).toContain("token={access.token}");
    expect(client).toContain("ConnectionState.Connecting");
    expect(client).toContain("ConnectionState.Connected");
    expect(client).toContain("ConnectionState.Reconnecting");
    expect(client).toContain("ConnectionState.SignalReconnecting");
    expect(client).toContain("ConnectionState.Disconnected");
    expect(client).not.toContain("simulateParticipants");
  });

  it("publishes and controls real local camera, microphone, and screen share", () => {
    const client = source("components/meetings/meeting-client.tsx");
    expect(client).toContain("audio={choice.microphoneEnabled");
    expect(client).toContain("video={choice.cameraEnabled");
    expect(client).toContain("localParticipant.setMicrophoneEnabled");
    expect(client).toContain("localParticipant.setCameraEnabled");
    expect(client).toContain("localParticipant.setScreenShareEnabled");
    expect(client).toContain("room.disconnect(true)");
    expect(client).toContain("stopStream(streamRef.current)");
  });

  it("renders room-derived participants, tracks, remote audio, counts, and active speakers", () => {
    const client = source("components/meetings/meeting-client.tsx");
    expect(client).toContain("useParticipants()");
    expect(client).toContain("useTracks([{ source: Track.Source.Camera, withPlaceholder: true }])");
    expect(client).toContain("useTracks([Track.Source.ScreenShare]");
    expect(client).toContain("<VideoTrack");
    expect(client).toContain("<RoomAudioRenderer");
    expect(client).toContain("participants.length");
    expect(client).toContain("useSpeakingParticipants()");
    expect(client).not.toContain("MeetingParticipant[]");
  });

  it("records lifecycle after connection and keeps normal leave separate from room end", () => {
    const client = source("components/meetings/meeting-client.tsx");
    const service = source("lib/meetings/service.ts");
    expect(client).toContain('connectionState === ConnectionState.Connected');
    expect(client).toContain('postEvent("PARTICIPANT_JOINED")');
    expect(client).toContain('postEvent("PARTICIPANT_LEFT")');
    expect(service).toContain('type === "PARTICIPANT_LEFT" ? { leftAt: now }');
    expect(service).toContain('data: { status: "ENDED", endedAt: now }');
    expect(service).toContain("participant.role === \"HOST\" || participant.role === \"CO_HOST\"");
  });

  it("preserves workspace-scoped dashboard, CRM validation, CallSession linkage, and navigation", () => {
    const service = source("lib/meetings/service.ts");
    const schema = source("prisma/schema.prisma");
    const nav = source("components/dashboard/shell.tsx");
    expect(service).toContain("await requireWorkspaceAccess(workspaceId)");
    expect(service).toContain('assertWorkspaceLink("lead", workspaceId, leadId)');
    expect(service).toContain("assertAvailableCallSession(workspaceId, callSessionId");
    expect(service).toContain("export async function updateMeeting");
    expect(service).toContain('"meeting.updated"');
    expect(schema).toContain("callSessionId String?       @unique");
    expect(source("components/dashboard/meeting-pages.tsx")).toContain("/dashboard/calls/${meeting.callSession.id}");
    expect(nav).toContain('["Meetings", "/dashboard/meetings"');
  });

  it("does not render fake room state, raw SDK errors, raw JSON, or credentials", () => {
    const client = source("components/meetings/meeting-client.tsx");
    const pages = source("components/dashboard/meeting-pages.tsx");
    expect(client).not.toContain("JSON.stringify(error)");
    expect(client).not.toContain("fake");
    expect(client).not.toContain("localStorage");
    expect(pages).not.toContain("JSON.stringify");
  });

  it("guards initial LiveKit disconnected state until after first successful connection", () => {
    const client = source("components/meetings/meeting-client.tsx");
    expect(client).toContain("const hasConnected = useRef(false)");
    expect(client).toContain("connectionState === ConnectionState.Connected && !hasConnected.current");
    expect(client).toContain("hasConnected.current = true");
    expect(client).toContain('void postEvent("PARTICIPANT_JOINED")');
    expect(client).toContain("connectionState === ConnectionState.Disconnected &&\n      hasConnected.current &&\n      !intentionalLeave.current");
    expect(client).not.toContain("connectionState === ConnectionState.Disconnected && !intentionalLeave.current");
  });

  it("keeps initial connection failures on the LiveKitRoom error path with readable copy", () => {
    const client = source("components/meetings/meeting-client.tsx");
    expect(client).toContain('onError={() => { setError("The meeting room could not be connected. Check your network and try again."); setState("failed"); }}');
    expect(client).not.toContain("setError(error instanceof Error ? error.message");
    expect(client).not.toContain("setError(String(");
  });

  it("preserves intentional leave and ended-meeting disconnect handling", () => {
    const client = source("components/meetings/meeting-client.tsx");
    expect(client).toContain('if (data.status === "ENDED")');
    expect(client).toContain("intentionalLeave.current = true;\n          await room.disconnect(true);\n          onExit(true);");
    expect(client).toContain("async function leave()");
    expect(client).toContain('intentionalLeave.current = true;\n    await room.disconnect(true);\n    await postEvent("PARTICIPANT_LEFT")');
    expect(client).toContain("async function end()");
    expect(client).toContain("intentionalLeave.current = true;\n      await room.disconnect(true);\n      onExit(true);");
  });

  it("does not duplicate access requests, room connections, or participant joined events", () => {
    const client = source("components/meetings/meeting-client.tsx");
    expect(client).toContain("if (requestRef.current) return requestRef.current");
    expect(client.match(/<LiveKitRoom/g)?.length).toBe(1);
    expect(client.match(/connect\n/g)?.length).toBe(1);
    expect(client.match(/postEvent\("PARTICIPANT_JOINED"\)/g)?.length).toBe(1);
  });

});
