import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const TYPE = "meeting_invitation";
const ISSUER = "quantumreach";
const AUDIENCE = "meeting_guest";

type Payload = { typ: typeof TYPE; iss: typeof ISSUER; aud: typeof AUDIENCE; invitationId: string; meetingId: string; version: number; exp: number };

function base64url(input: string | Buffer) { return Buffer.from(input).toString("base64url"); }
function unbase64url(input: string) { return Buffer.from(input, "base64url").toString("utf8"); }

export function getMeetingInvitationSecret() {
  const secret = process.env.MEETING_INVITATION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("MEETING_INVITATION_SECRET is required in production.");
  return "development-only-meeting-invitation-secret-change-me";
}

export function getCanonicalAppUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === "production") throw new Error("NEXT_PUBLIC_APP_URL is required in production.");
    return "http://localhost:3000";
  }
  const url = new URL(raw);
  if (process.env.NODE_ENV === "production" && url.hostname === "localhost") throw new Error("NEXT_PUBLIC_APP_URL must not be localhost in production.");
  return url.origin.replace(/\/$/, "");
}

export function maxInvitationExpiry(scheduledAt?: Date | null, now = new Date()) {
  return new Date((scheduledAt ?? now).getTime() + 24 * 60 * 60 * 1000);
}

export function signMeetingInvitationCredential(input: { invitationId: string; meetingId: string; tokenVersion: number; expiresAt: Date }) {
  const payload: Payload = { typ: TYPE, iss: ISSUER, aud: AUDIENCE, invitationId: input.invitationId, meetingId: input.meetingId, version: input.tokenVersion, exp: Math.floor(input.expiresAt.getTime() / 1000) };
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", getMeetingInvitationSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyMeetingInvitationCredential(token: string) {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) return null;
  const expected = createHmac("sha256", getMeetingInvitationSecret()).update(body).digest("base64url");
  const a = Buffer.from(signature, "base64url");
  const b = Buffer.from(expected, "base64url");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(unbase64url(body)) as Payload;
  if (payload.typ !== TYPE || payload.iss !== ISSUER || payload.aud !== AUDIENCE) return null;
  if (!payload.invitationId || !payload.meetingId || !payload.version || !payload.exp) return null;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function buildMeetingInvitationUrl(slug: string, credential: string) {
  return `${getCanonicalAppUrl()}/meet/${encodeURIComponent(slug)}?invite=${encodeURIComponent(credential)}`;
}
