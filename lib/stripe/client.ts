import { createHmac, timingSafeEqual } from "crypto";

const api = "https://api.stripe.com/v1";
function configured() { if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured."); return process.env.STRIPE_SECRET_KEY; }
function form(value: Record<string, string | number | boolean | undefined>) { const data = new URLSearchParams(); for (const [key, item] of Object.entries(value)) if (item !== undefined) data.set(key, String(item)); return data; }
export async function stripePost<T>(path: string, body: Record<string, string | number | boolean | undefined>, idempotencyKey?: string): Promise<T> {
  const response = await fetch(`${api}${path}`, { method: "POST", headers: { Authorization: `Bearer ${configured()}`, "Content-Type": "application/x-www-form-urlencoded", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) }, body: form(body).toString(), cache: "no-store" });
  const json = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(json.error?.message || "Stripe request failed.");
  return json;
}
export async function stripeGet<T>(path: string): Promise<T> {
  const response = await fetch(`${api}${path}`, { headers: { Authorization: `Bearer ${configured()}` }, cache: "no-store" });
  const json = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(json.error?.message || "Stripe request failed.");
  return json;
}
export function verifyStripeSignature(payload: string, header: string | null, secret = process.env.STRIPE_WEBHOOK_SECRET) {
  if (!secret || !header) return false;
  const pieces = header.split(","); const timestamp = pieces.find((part) => part.startsWith("t="))?.slice(2); const signatures = pieces.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || !signatures.length || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return signatures.some((signature) => signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected)));
}
