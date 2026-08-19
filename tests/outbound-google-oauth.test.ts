import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { GoogleOutboundProvider, getOutboundProviderForInbox, shouldUseGoogleProvider } from "@/lib/outbound/providers";

const db = vi.hoisted(() => ({
  inbox: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
}));
const audit = vi.hoisted(() => vi.fn(async () => ({})));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/audit/service", () => ({ audit }));

const source = (path: string) => readFileSync(path, "utf8");

const domain = { id: "dom_1", domain: "outreach.example.com" };
const inboxRow = {
  id: "inb_1",
  workspaceId: "w1",
  sendingDomainId: "dom_1",
  emailAddress: "hello@outreach.example.com",
  displayName: "Hello",
  status: "ACTIVE",
  health: "HEALTHY",
  provider: "google",
  googleConnectionStatus: "CONNECTED",
  googleAccessTokenEncrypted: null as string | null,
  googleRefreshTokenEncrypted: null as string | null,
  googleAccessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
  googleScopes: "email https://www.googleapis.com/auth/gmail.send",
  domain,
};

describe("outbound Google OAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTEGRATION_ENCRYPTION_KEY = "test-key-for-google-inbox-encryption";
    process.env.GOOGLE_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
    process.env.APP_BASE_URL = "https://preview.example";
    delete process.env.GOOGLE_REDIRECT_URI;
    process.env.MANAGED_SENDING_ENABLED = "true";
    db.inbox.findFirst.mockResolvedValue({ ...inboxRow });
    db.inbox.findUnique.mockResolvedValue({ ...inboxRow });
    db.inbox.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...inboxRow, ...data }));
  });

  it("signs workspace- and inbox-bound OAuth state", async () => {
    const { createGoogleOAuthState, verifyGoogleOAuthState } = await import("@/lib/outbound/google-oauth-state");
    const state = createGoogleOAuthState("w1", "user_a", "inb_1");
    expect(state.length).toBeGreaterThan(80);
    const parsed = verifyGoogleOAuthState(state);
    expect(parsed).toMatchObject({ workspaceId: "w1", userId: "user_a", inboxId: "inb_1" });
    expect(() => verifyGoogleOAuthState(state.replace(/.$/, "x"))).toThrow();
  });

  it("builds the Google redirect from APP_BASE_URL", async () => {
    const { googleAuthorizationUrl, googleOAuthEnv } = await import("@/lib/outbound/google-oauth");
    expect(googleOAuthEnv().redirectUri).toBe("https://preview.example/api/integrations/google/callback");
    const url = new URL(googleAuthorizationUrl("state-value", "hello@outreach.example.com"));
    expect(url.searchParams.get("scope")).toContain("gmail.send");
    expect(url.searchParams.get("scope")).not.toContain("gmail.readonly");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("login_hint")).toBe("hello@outreach.example.com");
  });

  it("requires the inbox address to match the sending domain and Google account", async () => {
    const { inboxEmailMatchesDomain, emailsEqual, bindGoogleInbox } = await import("@/lib/outbound/google-oauth");
    expect(inboxEmailMatchesDomain("hello@outreach.example.com", "outreach.example.com")).toBe(true);
    expect(inboxEmailMatchesDomain("hello@gmail.com", "outreach.example.com")).toBe(false);
    expect(emailsEqual("Hello@Outreach.example.com", "hello@outreach.example.com")).toBe(true);

    db.inbox.findFirst.mockResolvedValue({
      ...inboxRow,
      emailAddress: "hello@other.com",
    });
    await expect(
      bindGoogleInbox({
        inboxId: "inb_1",
        workspaceId: "w1",
        connectedById: "user_a",
        accessToken: "access-token",
        refreshToken: "refresh-token",
        googleAccountEmail: "hello@other.com",
      }),
    ).rejects.toThrow("match its sending domain");

    db.inbox.findFirst.mockResolvedValue({ ...inboxRow });
    await expect(
      bindGoogleInbox({
        inboxId: "inb_1",
        workspaceId: "w1",
        connectedById: "user_a",
        accessToken: "access-token",
        refreshToken: "refresh-token",
        googleAccountEmail: "someone@gmail.com",
      }),
    ).rejects.toThrow("exactly this inbox address");
  });

  it("encrypts tokens at rest and never writes them to audit metadata", async () => {
    const { bindGoogleInbox } = await import("@/lib/outbound/google-oauth");
    const { decryptSecret, isEncryptedSecret } = await import("@/lib/security/encryption");
    await bindGoogleInbox({
      inboxId: "inb_1",
      workspaceId: "w1",
      connectedById: "user_a",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      googleAccountEmail: "hello@outreach.example.com",
    });
    const data = db.inbox.update.mock.calls[0][0].data as {
      googleAccessTokenEncrypted: string;
      googleRefreshTokenEncrypted: string;
      googleConnectionStatus: string;
      health: string;
    };
    expect(isEncryptedSecret(data.googleAccessTokenEncrypted)).toBe(true);
    expect(data.googleAccessTokenEncrypted).not.toContain("access-token");
    expect(decryptSecret(data.googleAccessTokenEncrypted)).toBe("access-token");
    expect(decryptSecret(data.googleRefreshTokenEncrypted)).toBe("refresh-token");
    expect(data.googleConnectionStatus).toBe("CONNECTED");
    expect(data.health).toBe("HEALTHY");
    expect(JSON.stringify(audit.mock.calls)).not.toContain("access-token");
    expect(JSON.stringify(audit.mock.calls)).not.toContain("refresh-token");
  });

  it("disconnects, revokes, clears tokens, and marks the inbox unhealthy", async () => {
    const { encryptSecret } = await import("@/lib/security/encryption");
    const { disconnectGoogleInbox } = await import("@/lib/outbound/google-oauth");
    db.inbox.findFirst.mockResolvedValue({
      ...inboxRow,
      googleAccessTokenEncrypted: encryptSecret("access-token"),
      googleRefreshTokenEncrypted: encryptSecret("refresh-token"),
    });
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    await disconnectGoogleInbox("inb_1", "w1", "user_a", db as never, fetchImpl as never);
    expect(fetchImpl).toHaveBeenCalled();
    expect(db.inbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          googleConnectionStatus: "REVOKED",
          googleAccessTokenEncrypted: null,
          googleRefreshTokenEncrypted: null,
          health: "UNHEALTHY",
        }),
      }),
    );
  });

  it("prefers Google only when the inbox is connected and managed sending is on", () => {
    const connected = {
      id: "inb_1",
      emailAddress: "hello@outreach.example.com",
      provider: "google",
      googleConnectionStatus: "CONNECTED",
      googleAccessTokenEncrypted: "v1:x",
    };
    expect(shouldUseGoogleProvider(connected, { MANAGED_SENDING_ENABLED: "true" })).toBe(true);
    expect(getOutboundProviderForInbox(connected, { MANAGED_SENDING_ENABLED: "true" }).id).toBe("google");
    expect(getOutboundProviderForInbox(connected, { MANAGED_SENDING_ENABLED: "false" }).id).toBe("stub");
    expect(
      getOutboundProviderForInbox(
        { ...connected, googleConnectionStatus: "DISCONNECTED", googleAccessTokenEncrypted: null },
        { MANAGED_SENDING_ENABLED: "true" },
      ).id,
    ).toBe("stub");
  });

  it("does not call Gmail when the sending gate is off or the inbox is not connected", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    process.env.MANAGED_SENDING_ENABLED = "false";
    const connected = {
      id: "inb_1",
      emailAddress: "hello@outreach.example.com",
      provider: "google" as const,
      googleConnectionStatus: "CONNECTED",
      googleAccessTokenEncrypted: "v1:x",
    };
    await expect(
      new GoogleOutboundProvider(connected).send({
        fromInbox: { id: "inb_1", emailAddress: "hello@outreach.example.com" },
        to: "prospect@example.com",
        subject: "Hi",
        body: "Hello",
      }),
    ).resolves.toEqual({ ok: false, provider: "google", reason: "MANAGED_SENDING_DISABLED" });
    process.env.MANAGED_SENDING_ENABLED = "true";
    await expect(
      new GoogleOutboundProvider(null).send({
        fromInbox: { id: "inb_1", emailAddress: "hello@outreach.example.com" },
        to: "prospect@example.com",
        subject: "Hi",
        body: "Hello",
      }),
    ).resolves.toEqual({ ok: false, provider: "google", reason: "GOOGLE_OAUTH_NOT_CONNECTED" });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("sends through Gmail and maps auth / bounce failures", async () => {
    const { encryptSecret } = await import("@/lib/security/encryption");
    const { sendViaGmail, mapGmailSendError } = await import("@/lib/outbound/google-oauth");
    expect(mapGmailSendError(401).reason).toBe("AUTH_REVOKED");
    expect(mapGmailSendError(400, "Invalid To header").bounceLike).toBe(true);

    const access = encryptSecret("access-token");
    const connected = {
      ...inboxRow,
      googleAccessTokenEncrypted: access,
      googleRefreshTokenEncrypted: encryptSecret("refresh-token"),
    };
    db.inbox.findUnique.mockResolvedValue(connected);

    const sendOk = vi.fn(async (url: string) => {
      if (String(url).includes("gmail.googleapis.com")) {
        return new Response(JSON.stringify({ id: "msg_1" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("unexpected", { status: 500 });
    });
    await expect(
      sendViaGmail(connected, {
        fromInbox: { id: "inb_1", emailAddress: "hello@outreach.example.com" },
        to: "prospect@example.com",
        subject: "Hi",
        body: "Hello",
      }, { db: db as never, fetchImpl: sendOk as never }),
    ).resolves.toEqual({ ok: true, provider: "google", providerMessageId: "msg_1" });
    expect(String(sendOk.mock.calls[0][0])).toContain("gmail.googleapis.com");
    expect(JSON.stringify(sendOk.mock.calls)).not.toContain("refresh-token");

    const sendAuth = vi.fn(async () => new Response("invalid token", { status: 401 }));
    await expect(
      sendViaGmail(connected, {
        fromInbox: { id: "inb_1", emailAddress: "hello@outreach.example.com" },
        to: "prospect@example.com",
        subject: "Hi",
        body: "Hello",
      }, { db: db as never, fetchImpl: sendAuth as never }),
    ).resolves.toEqual({ ok: false, provider: "google", reason: "AUTH_REVOKED" });
    expect(db.inbox.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ health: "UNHEALTHY", googleConnectionStatus: "REVOKED" }) }),
    );
  });

  it("does not send campaign mail through SES", () => {
    for (const path of [
      "lib/outbound/providers.ts",
      "lib/outbound/google-oauth.ts",
      "lib/outbound/campaigns.ts",
      "app/api/integrations/google/connect/route.ts",
      "app/api/integrations/google/callback/route.ts",
    ]) {
      expect(source(path)).not.toContain("@aws-sdk/client-ses");
      expect(source(path)).not.toMatch(/console\.log/);
    }
    expect(source("lib/outbound/providers.ts")).toContain("GOOGLE_OAUTH_NOT_CONNECTED");
    expect(source("app/dashboard/sending/outbound/page.tsx")).toContain("Connect Google");
    expect(source("app/dashboard/sending/outbound/page.tsx")).toContain("MANAGED_SENDING_ENABLED");
  });
});
