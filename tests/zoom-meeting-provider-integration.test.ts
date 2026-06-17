import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("Zoom provider integration security helpers", () => {
  it("encrypts tokens with versioned ciphertext and decrypts without storing plaintext", async () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = "test-key-for-zoom-provider-encryption";
    const { encryptSecret, decryptSecret, isEncryptedSecret } = await import("../lib/security/encryption");
    const encrypted = encryptSecret("zoom-access-token");
    expect(encrypted).not.toContain("zoom-access-token");
    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(decryptSecret(encrypted)).toBe("zoom-access-token");
  });

  it("creates high entropy workspace/user-bound OAuth state", async () => {
    process.env.ZOOM_CLIENT_SECRET = "oauth-state-secret";
    const { createZoomOAuthState, verifyZoomOAuthState } = await import("../lib/meetings/providers/zoom-oauth-state");
    const state = createZoomOAuthState("workspace_a", "user_a");
    expect(state.length).toBeGreaterThan(80);
    const parsed = verifyZoomOAuthState(state);
    expect(parsed.workspaceId).toBe("workspace_a");
    expect(parsed.userId).toBe("user_a");
    expect(() => verifyZoomOAuthState(state.replace(/.$/, "x"))).toThrow();
  });

  it("computes Zoom URL validation token and rejects stale webhook signatures", async () => {
    process.env.ZOOM_WEBHOOK_SECRET_TOKEN = "zoom-webhook-secret";
    const { computeZoomValidationToken, verifyZoomWebhookSignature } = await import("../lib/meetings/providers/zoom");
    expect(computeZoomValidationToken("plain-token")).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyZoomWebhookSignature("{}", String(Date.now() - 600_000), "v0=bad")).toBe(false);
  });
});
