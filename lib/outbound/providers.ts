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

/** Phase 3 Google OAuth lives behind this flag. Campaigns stay on the stub until then. */
export class GoogleOutboundProvider implements OutboundProvider {
  id = "google";
  async send(): Promise<OutboundSendResult> {
    return { ok: false, provider: this.id, reason: "GOOGLE_OAUTH_NOT_CONNECTED" };
  }
}

export function getOutboundProvider(env: Record<string, string | undefined> = process.env): OutboundProvider {
  if (env.OUTBOUND_GOOGLE_ENABLED === "true") return new GoogleOutboundProvider();
  return new StubOutboundProvider();
}
