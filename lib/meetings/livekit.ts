import "server-only";

import { createHmac } from "node:crypto";
import type { MeetingParticipantRole } from "@prisma/client";

type LiveKitTokenInput = {
  roomName: string;
  identity: string;
  displayName: string;
  role: MeetingParticipantRole;
};

function required(name: "LIVEKIT_URL" | "LIVEKIT_API_KEY" | "LIVEKIT_API_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("LiveKit configuration is unavailable.");
  return value;
}

function base64url(value: string) {
  return Buffer.from(value).toString("base64url");
}

export function getLiveKitUrl() {
  return required("LIVEKIT_URL");
}

export function createLiveKitAccessToken(input: LiveKitTokenInput) {
  const apiKey = required("LIVEKIT_API_KEY");
  const apiSecret = required("LIVEKIT_API_SECRET");
  const now = Math.floor(Date.now() / 1000);
  const isRoomAdmin = input.role === "HOST" || input.role === "CO_HOST";
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: apiKey,
    sub: input.identity,
    name: input.displayName,
    metadata: JSON.stringify({ role: input.role }),
    nbf: now - 5,
    exp: now + 15 * 60,
    video: {
      room: input.roomName,
      roomJoin: true,
      roomAdmin: isRoomAdmin,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    }
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createHmac("sha256", apiSecret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}
