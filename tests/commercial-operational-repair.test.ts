import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getWorkspaceAIAdapter } from "@/lib/ai/adapters";
import { enforceLiveSend } from "@/lib/sending-infrastructure/warmup";
import { AwsSesTransport } from "@/lib/sending-infrastructure/ses";

describe("shared live transport boundary", () => {
  it("cannot be called without managed send context", async () => {
    const result = await new AwsSesTransport().sendEmail({ from: "a@example.com", to: ["b@example.com"], subject: "x" });
    expect(result).toMatchObject({ sent: false, reason: "LIVE_SENDING_CONTEXT_REQUIRED" });
  });
  it.each([["WARMING", "LIVE_READY", "MAILBOX_NOT_LIVE_READY"], ["LIVE_READY", "PAUSED", "DOMAIN_NOT_LIVE_READY"]] as const)("blocks %s/%s", (mailboxState, domainState, code) => {
    const result = enforceLiveSend({ mailboxState, domainState, providerHealthy: true, campaignApproved: true, suppressed: false, subscriptionActive: true, monthlyRemaining: 1, mailboxRemaining: 1, domainRemaining: 1, liveSendingEnabled: true, preview: false });
    expect(result.code).toBe(code);
  });
  it("returns stable suppression and capacity errors", () => {
    const base = { mailboxState: "LIVE_READY", domainState: "LIVE_READY", providerHealthy: true, campaignApproved: true, subscriptionActive: true, monthlyRemaining: 1, mailboxRemaining: 1, domainRemaining: 1, liveSendingEnabled: true, preview: false } as const;
    expect(enforceLiveSend({ ...base, suppressed: true }).code).toBe("RECIPIENT_SUPPRESSED");
    expect(enforceLiveSend({ ...base, suppressed: false, monthlyRemaining: 0 }).code).toBe("PLAN_SEND_LIMIT_REACHED");
  });
});

describe("provider-neutral AI adapters", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
    ok: true, status: 200, headers: new Headers({ "x-request-id": "req_1" }),
    json: async () => url.includes("anthropic") ? { id: "a", content: [{ text: "OK" }], usage: { input_tokens: 1, output_tokens: 1 } } : url.includes("googleapis") ? { candidates: [{ content: { parts: [{ text: "OK" }] } }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } } : { id: "o", choices: [{ message: { content: "OK" } }], usage: { prompt_tokens: 1, completion_tokens: 1 } },
  }))));
  afterEach(() => vi.unstubAllGlobals());
  it.each([["OPENAI", "gpt-4.1-mini"], ["ANTHROPIC", "claude-sonnet-4-20250514"], ["GEMINI", "gemini-2.5-flash"]] as const)("tests %s through one interface", async (provider, model) => {
    const result = await getWorkspaceAIAdapter(provider).test("development-key", model);
    expect(result).toMatchObject({ ok: true, provider, model, text: "OK" });
    expect(result.inputTokens).toBe(1);
  });
});
