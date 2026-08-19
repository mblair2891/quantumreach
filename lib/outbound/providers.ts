export type OutboundSendRequest = {
  fromInbox: { id: string; emailAddress: string; displayName?: string | null };
  fromName?: string | null;
  to: string;
  subject: string;
  body: string;
};

export type OutboundSendResult =
  | { ok: true; provider: string; providerMessageId?: string }
  | { ok: false; provider: string; reason: string };

export type OutboundProvider = {
  id: string;
  send(input: OutboundSendRequest): Promise<OutboundSendResult>;
};

export type OutboundInboxConnection = {
  id: string;
  emailAddress: string;
  displayName?: string | null;
  provider?: string | null;
  googleConnectionStatus?: string | null;
  googleAccessTokenEncrypted?: string | null;
  googleRefreshTokenEncrypted?: string | null;
  health?: string | null;
};

/** Dev/Preview provider. Does not use SES or Google. */
export class StubOutboundProvider implements OutboundProvider {
  id = "stub";
  async send(input: OutboundSendRequest): Promise<OutboundSendResult> {
    if (!input.to.includes("@") || !input.fromInbox.emailAddress.includes("@")) {
      return { ok: false, provider: this.id, reason: "INVALID_ADDRESS" };
    }
    return { ok: true, provider: this.id, providerMessageId: `stub:${input.fromInbox.id}:${Date.now()}` };
  }
}

export function isGoogleInboxConnected(inbox: OutboundInboxConnection | null | undefined) {
  if (!inbox) return false;
  return (
    inbox.provider === "google" &&
    inbox.googleConnectionStatus === "CONNECTED" &&
    Boolean(inbox.googleAccessTokenEncrypted || inbox.googleRefreshTokenEncrypted)
  );
}

export function shouldUseGoogleProvider(
  inbox: OutboundInboxConnection | null | undefined,
  env: Record<string, string | undefined> = process.env,
) {
  return env.MANAGED_SENDING_ENABLED === "true" && isGoogleInboxConnected(inbox);
}

/** Gmail API send through a connected inbox. Never uses SES. */
export class GoogleOutboundProvider implements OutboundProvider {
  id = "google";
  constructor(
    private inbox?: OutboundInboxConnection | null,
    private env: Record<string, string | undefined> = process.env,
  ) {}
  async send(input: OutboundSendRequest): Promise<OutboundSendResult> {
    if (this.env.MANAGED_SENDING_ENABLED !== "true") {
      return { ok: false, provider: this.id, reason: "MANAGED_SENDING_DISABLED" };
    }
    if (!this.inbox || !isGoogleInboxConnected(this.inbox)) {
      return { ok: false, provider: this.id, reason: "GOOGLE_OAUTH_NOT_CONNECTED" };
    }
    const { sendViaGmail } = await import("./google-oauth");
    return sendViaGmail(this.inbox, input, { env: this.env });
  }
}

export function getOutboundProviderForInbox(
  inbox: OutboundInboxConnection,
  env: Record<string, string | undefined> = process.env,
): OutboundProvider {
  if (shouldUseGoogleProvider(inbox, env)) return new GoogleOutboundProvider(inbox, env);
  return new StubOutboundProvider();
}

/** Default when no inbox is in context. Always stub — never SES. */
export function getOutboundProvider(): OutboundProvider {
  return new StubOutboundProvider();
}
