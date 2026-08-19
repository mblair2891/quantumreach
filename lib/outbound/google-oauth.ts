import "server-only";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/audit/service";
import { decryptSecret, encryptSecret } from "@/lib/security/encryption";
import { isGoogleInboxConnected, type OutboundInboxConnection, type OutboundSendRequest, type OutboundSendResult } from "./providers";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo";
const GMAIL_SEND = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const REFRESH_WINDOW_MS = 5 * 60 * 1000;

type Db = typeof prisma;

export const GMAIL_SEND_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.send"].join(" ");

export class GoogleAuthRevokedError extends Error {
  constructor() {
    super("AUTH_REVOKED");
    this.name = "GoogleAuthRevokedError";
  }
}

export function isGoogleOAuthConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim());
}

export function googleOAuthEnv(env: Record<string, string | undefined> = process.env) {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const base = (env.APP_BASE_URL || env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const redirectUri = env.GOOGLE_REDIRECT_URI?.trim() || `${base}/api/integrations/google/callback`;
  if (!clientId || !clientSecret) throw new Error("Google OAuth client configuration is missing.");
  return { clientId, clientSecret, redirectUri };
}

export function inboxEmailMatchesDomain(emailAddress: string, hostname: string) {
  const email = emailAddress.trim().toLowerCase();
  const host = hostname.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0 || !host) return false;
  return email.slice(at + 1) === host;
}

export function emailsEqual(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function googleAuthorizationUrl(state: string, loginHint?: string, env: Record<string, string | undefined> = process.env) {
  const { clientId, redirectUri } = googleOAuthEnv(env);
  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", GMAIL_SEND_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "false");
  if (loginHint) url.searchParams.set("login_hint", loginHint);
  return url.toString();
}

export type GoogleTokenResult = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes?: string;
};

function asTokenResult(json: { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string }): GoogleTokenResult {
  if (!json.access_token) throw new Error("Google token exchange failed.");
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : undefined,
    scopes: json.scope,
  };
}

export async function exchangeGoogleCode(code: string, env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): Promise<GoogleTokenResult> {
  const { clientId, clientSecret, redirectUri } = googleOAuthEnv(env);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });
  const res = await fetchImpl(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Google authorization code exchange failed.");
  return asTokenResult((await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string });
}

export async function fetchGoogleAccountEmail(accessToken: string, fetchImpl: typeof fetch = fetch) {
  const res = await fetchImpl(GOOGLE_USERINFO, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error("Could not read the Google account email.");
  const json = (await res.json()) as { email?: string };
  const email = json.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Google did not return an account email.");
  return email;
}

async function revokeGoogleToken(token: string | null, fetchImpl: typeof fetch = fetch) {
  if (!token) return;
  await fetchImpl(GOOGLE_REVOKE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined);
}

function safeDecrypt(value?: string | null) {
  if (!value) return null;
  try {
    return decryptSecret(value);
  } catch {
    return null;
  }
}

export async function bindGoogleInbox(
  input: {
    inboxId: string;
    workspaceId: string;
    connectedById: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scopes?: string;
    googleAccountEmail: string;
  },
  db: Db = prisma,
) {
  const inbox = await db.inbox.findFirst({
    where: { id: input.inboxId, workspaceId: input.workspaceId },
    include: { domain: true },
  });
  if (!inbox) throw new Error("Inbox was not found.");
  if (!inboxEmailMatchesDomain(inbox.emailAddress, inbox.domain.domain)) {
    throw new Error("Inbox address must match its sending domain.");
  }
  if (!emailsEqual(input.googleAccountEmail, inbox.emailAddress)) {
    throw new Error("The Google account must be exactly this inbox address.");
  }
  const record = await db.inbox.update({
    where: { id: inbox.id },
    data: {
      provider: "google",
      googleConnectionStatus: "CONNECTED",
      googleAccessTokenEncrypted: encryptSecret(input.accessToken),
      googleRefreshTokenEncrypted: input.refreshToken
        ? encryptSecret(input.refreshToken)
        : inbox.googleRefreshTokenEncrypted,
      googleAccessTokenExpiresAt: input.expiresAt ?? null,
      googleScopes: input.scopes ?? GMAIL_SEND_SCOPES,
      googleConnectedAt: new Date(),
      googleConnectedById: input.connectedById,
      googleAccountEmail: input.googleAccountEmail.trim().toLowerCase(),
      health: "HEALTHY",
      status: "ACTIVE",
      lastError: null,
    },
  });
  await audit(input.workspaceId, "google.inbox_connected", "Inbox", inbox.id, input.connectedById, {
    provider: "google",
    emailAddress: inbox.emailAddress,
  });
  return record;
}

export async function disconnectGoogleInbox(inboxId: string, workspaceId: string, actorId?: string, db: Db = prisma, fetchImpl: typeof fetch = fetch) {
  const inbox = await db.inbox.findFirst({ where: { id: inboxId, workspaceId } });
  if (!inbox) throw new Error("Inbox was not found.");
  const access = safeDecrypt(inbox.googleAccessTokenEncrypted);
  const refresh = safeDecrypt(inbox.googleRefreshTokenEncrypted);
  await revokeGoogleToken(access || refresh, fetchImpl);
  const record = await db.inbox.update({
    where: { id: inbox.id },
    data: {
      googleConnectionStatus: "REVOKED",
      googleAccessTokenEncrypted: null,
      googleRefreshTokenEncrypted: null,
      googleAccessTokenExpiresAt: null,
      googleScopes: null,
      googleConnectedAt: null,
      googleConnectedById: null,
      health: "UNHEALTHY",
      lastError: "Google disconnected. Reconnect this inbox to send from it.",
    },
  });
  await audit(workspaceId, "google.inbox_disconnected", "Inbox", inbox.id, actorId, {
    provider: "google",
    emailAddress: inbox.emailAddress,
  });
  return record;
}

export async function markInboxGoogleUnhealthy(
  inboxId: string,
  status: "EXPIRED" | "REVOKED" | "ERROR",
  lastError: string,
  db: Db = prisma,
) {
  const inbox = await db.inbox.update({
    where: { id: inboxId },
    data: {
      googleConnectionStatus: status,
      health: "UNHEALTHY",
      lastError,
      ...(status === "REVOKED"
        ? {
            googleAccessTokenEncrypted: null,
            googleRefreshTokenEncrypted: null,
            googleAccessTokenExpiresAt: null,
          }
        : {}),
    },
  });
  await audit(inbox.workspaceId, "google.inbox_unhealthy", "Inbox", inbox.id, undefined, {
    provider: "google",
    status,
  });
  return inbox;
}

export async function refreshGoogleAccessToken(inbox: { id: string }, db: Db = prisma, fetchImpl: typeof fetch = fetch): Promise<string> {
  const row = await db.inbox.findUnique({ where: { id: inbox.id } });
  if (!row || !isGoogleInboxConnected(row)) throw new GoogleAuthRevokedError();
  const stillValid =
    row.googleAccessTokenExpiresAt && row.googleAccessTokenExpiresAt.getTime() > Date.now() + REFRESH_WINDOW_MS;
  if (stillValid && row.googleAccessTokenEncrypted) {
    const current = safeDecrypt(row.googleAccessTokenEncrypted);
    if (current) return current;
  }
  const refreshToken = safeDecrypt(row.googleRefreshTokenEncrypted);
  if (!refreshToken) {
    await markInboxGoogleUnhealthy(row.id, "EXPIRED", "Google access expired. Reconnect this inbox.", db);
    throw new GoogleAuthRevokedError();
  }
  try {
    const { clientId, clientSecret } = googleOAuthEnv();
    const res = await fetchImpl(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!res.ok) throw new GoogleAuthRevokedError();
    const token = asTokenResult((await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string });
    await db.inbox.update({
      where: { id: row.id },
      data: {
        googleAccessTokenEncrypted: encryptSecret(token.accessToken),
        googleRefreshTokenEncrypted: token.refreshToken ? encryptSecret(token.refreshToken) : row.googleRefreshTokenEncrypted,
        googleAccessTokenExpiresAt: token.expiresAt ?? row.googleAccessTokenExpiresAt,
        googleScopes: token.scopes ?? row.googleScopes,
        googleConnectionStatus: "CONNECTED",
        health: "HEALTHY",
        lastError: null,
      },
    });
    await audit(row.workspaceId, "google.inbox_refreshed", "Inbox", row.id, undefined, { provider: "google" });
    return token.accessToken;
  } catch (error) {
    await markInboxGoogleUnhealthy(row.id, "REVOKED", "Google access was revoked. Reconnect this inbox.", db);
    if (error instanceof GoogleAuthRevokedError) throw error;
    throw new GoogleAuthRevokedError();
  }
}

export function encodeRfc2047(value: string) {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

export function formatFromAddress(email: string, name?: string | null) {
  const trimmed = name?.replace(/[\r\n"]/g, "").trim();
  if (!trimmed) return email;
  return `${trimmed} <${email}>`;
}

export function buildGmailRawMessage(input: { from: string; to: string; subject: string; body: string }) {
  const rfc822 = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${encodeRfc2047(input.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(input.body, "utf8").toString("base64"),
  ].join("\r\n");
  return Buffer.from(rfc822, "utf8").toString("base64url");
}

export function mapGmailSendError(status: number, errorText = "") {
  const text = errorText.toLowerCase();
  if (status === 401 || status === 403) {
    return { reason: "AUTH_REVOKED", revoke: true, bounceLike: false };
  }
  const bounce =
    status === 400 &&
    (text.includes("invalid") ||
      text.includes("recipient") ||
      text.includes("bounce") ||
      text.includes("not found") ||
      text.includes("failedprecondition"));
  if (bounce) return { reason: "BOUNCE_LIKE", revoke: false, bounceLike: true };
  if (status === 429) return { reason: "RATE_LIMITED", revoke: false, bounceLike: false };
  return { reason: `GMAIL_ERROR_${status}`, revoke: false, bounceLike: false };
}

export async function sendViaGmail(
  inbox: OutboundInboxConnection & { id: string },
  input: OutboundSendRequest,
  deps: { db?: Db; fetchImpl?: typeof fetch; env?: Record<string, string | undefined> } = {},
): Promise<OutboundSendResult> {
  const env = deps.env ?? process.env;
  const db = deps.db ?? prisma;
  const fetchImpl = deps.fetchImpl ?? fetch;
  if (env.MANAGED_SENDING_ENABLED !== "true") {
    return { ok: false, provider: "google", reason: "MANAGED_SENDING_DISABLED" };
  }
  if (!isGoogleInboxConnected(inbox)) {
    return { ok: false, provider: "google", reason: "GOOGLE_OAUTH_NOT_CONNECTED" };
  }
  try {
    const accessToken = await refreshGoogleAccessToken(inbox, db, fetchImpl);
    const raw = buildGmailRawMessage({
      from: formatFromAddress(input.fromInbox.emailAddress, input.fromName || input.fromInbox.displayName),
      to: input.to,
      subject: input.subject,
      body: input.body,
    });
    const res = await fetchImpl(GMAIL_SEND, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const mapped = mapGmailSendError(res.status, text);
      if (mapped.revoke) {
        await markInboxGoogleUnhealthy(inbox.id, "REVOKED", "Google access was revoked. Reconnect this inbox.", db);
        return { ok: false, provider: "google", reason: "AUTH_REVOKED" };
      }
      await db.inbox.update({
        where: { id: inbox.id },
        data: { lastError: mapped.bounceLike ? "Gmail rejected the recipient." : "Gmail could not send this message." },
      });
      return { ok: false, provider: "google", reason: mapped.reason };
    }
    const json = (await res.json()) as { id?: string };
    await db.inbox.update({ where: { id: inbox.id }, data: { lastError: null } });
    return { ok: true, provider: "google", providerMessageId: json.id };
  } catch (error) {
    if (error instanceof GoogleAuthRevokedError) {
      return { ok: false, provider: "google", reason: "AUTH_REVOKED" };
    }
    return { ok: false, provider: "google", reason: "GMAIL_NETWORK" };
  }
}
