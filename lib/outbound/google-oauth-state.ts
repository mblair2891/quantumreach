import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TTL_MS = 10 * 60 * 1000;

function secret() {
  return process.env.GOOGLE_CLIENT_SECRET || process.env.INTEGRATION_ENCRYPTION_KEY || "missing";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export type GoogleOAuthState = {
  workspaceId: string;
  userId: string;
  inboxId: string;
  nonce: string;
  exp: number;
};

export function createGoogleOAuthState(workspaceId: string, userId: string, inboxId: string) {
  const body = Buffer.from(
    JSON.stringify({
      workspaceId,
      userId,
      inboxId,
      nonce: randomBytes(32).toString("base64url"),
      exp: Date.now() + TTL_MS,
    } satisfies GoogleOAuthState),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyGoogleOAuthState(state: string): GoogleOAuthState {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("Invalid OAuth state.");
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Invalid OAuth state.");
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as GoogleOAuthState;
  if (!parsed.workspaceId || !parsed.userId || !parsed.inboxId || !parsed.nonce || parsed.exp < Date.now()) {
    throw new Error("Expired OAuth state.");
  }
  return parsed;
}
