import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";

function key() {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) throw new Error("INTEGRATION_ENCRYPTION_KEY is required for provider credential encryption.");
  if (/^[A-Za-z0-9+/=]{44,}$/.test(raw)) {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) return decoded;
  }
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plaintext: string) {
  if (!plaintext) throw new Error("Cannot encrypt an empty secret.");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptSecret(value: string) {
  const [version, iv, tag, ciphertext] = value.split(":");
  if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error("Unsupported encrypted secret format.");
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function isEncryptedSecret(value?: string | null) { return Boolean(value?.startsWith(`${VERSION}:`)); }
