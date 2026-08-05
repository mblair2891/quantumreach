import { createHash, randomBytes } from "node:crypto";

export function hashSetupToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function generateRawSetupToken() {
  return randomBytes(32).toString("base64url");
}
