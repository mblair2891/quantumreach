import "server-only";
import crypto from "crypto";
import type { MeetingParticipantRole } from "@prisma/client";

export class LiveKitConfigurationError extends Error { constructor(message = "LiveKit is not configured. Add LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.") { super(message); this.name = "LiveKitConfigurationError"; } }
export function getLiveKitConfig() {
  const url = process.env.LIVEKIT_URL, apiKey = process.env.LIVEKIT_API_KEY, apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) throw new LiveKitConfigurationError();
  return { url, apiKey, apiSecret };
}
export function generateMeetingSlug() { return crypto.randomBytes(24).toString("base64url"); }
export function generateInvitationToken() { return crypto.randomBytes(32).toString("base64url"); }
export function hashInvitationToken(token: string) { return crypto.createHash("sha256").update(token).digest("hex"); }
export function generateLiveKitRoomName(workspaceId: string) { return `qr-${workspaceId.slice(-8)}-${crypto.randomBytes(10).toString("hex")}`.replace(/[^a-zA-Z0-9_-]/g, "-"); }
export function participantIdentity(meetingId: string, subjectId: string) { return `qr_${meetingId.slice(-10)}_${subjectId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(-32)}`; }
function b64(input: object) { return Buffer.from(JSON.stringify(input)).toString("base64url"); }
export function createLiveKitToken(input: { roomName: string; identity: string; displayName: string; meetingId: string; workspaceId: string; role: MeetingParticipantRole }) {
  const { apiKey, apiSecret } = getLiveKitConfig();
  const now = Math.floor(Date.now() / 1000), exp = now + 60 * 20;
  const isHost = input.role === "HOST" || input.role === "CO_HOST";
  const grants = { video: { roomJoin: true, room: input.roomName, canPublish: true, canSubscribe: true, canPublishData: true, canUpdateOwnMetadata: true, roomAdmin: isHost } };
  const payload = { iss: apiKey, sub: input.identity, name: input.displayName, iat: now, nbf: now - 5, exp, video: grants.video, metadata: JSON.stringify({ meetingId: input.meetingId, workspaceId: input.workspaceId, role: input.role, displayName: input.displayName }) };
  const unsigned = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}`;
  const sig = crypto.createHmac("sha256", apiSecret).update(unsigned).digest("base64url");
  return { token: `${unsigned}.${sig}`, url: process.env.LIVEKIT_URL!, expiresAt: new Date(exp * 1000), identity: input.identity, canAdmin: isHost };
}
