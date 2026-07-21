import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "@/lib/stripe/client";

describe("Stripe webhook verification", () => {
  it("accepts a valid signed raw payload", () => {
    const payload = '{"id":"evt_1"}'; const timestamp = Math.floor(Date.now() / 1000); const secret = "whsec_test";
    const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
    expect(verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret)).toBe(true);
  });
  it("rejects invalid signatures", () => expect(verifyStripeSignature("{}", "t=1,v1=bad", "whsec_test")).toBe(false));
});
