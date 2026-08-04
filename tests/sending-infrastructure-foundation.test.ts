import { describe, expect, it } from "vitest";
import { aggregateEntitlements, COMMERCE_PRODUCT_KEYS, ENTITLEMENT_KEYS } from "@/lib/sending-infrastructure/catalog";
import { enforceAllowance, evaluateOutboundSendEligibility, evaluateSenderReadiness } from "@/lib/sending-infrastructure/readiness";
import { AwsSesTransport, ensureSesDomainIdentity } from "@/lib/sending-infrastructure/ses";
import { reconcileDns } from "@/lib/sending-infrastructure/dns";
import { getMailboxProvider } from "@/lib/sending-infrastructure/providers";
import { provisionManagedMailboxPlan } from "@/lib/sending-infrastructure/provisioning";
import { redactSecrets, safeErrorMessage } from "@/lib/sending-infrastructure/security";

describe("managed sending infrastructure foundations", () => {
  it("aggregates core, package, and add-ons without replay double-counting", () => {
    const entitlements = aggregateEntitlements([
      { productKey: COMMERCE_PRODUCT_KEYS.CORE, stripeSubscriptionItemId: "si_core" },
      { productKey: COMMERCE_PRODUCT_KEYS.GROWTH, stripeSubscriptionItemId: "si_growth" },
      { productKey: COMMERCE_PRODUCT_KEYS.GROWTH, stripeSubscriptionItemId: "si_growth" },
      { productKey: COMMERCE_PRODUCT_KEYS.DOMAIN_PACK, quantity: 2, stripeSubscriptionItemId: "si_domain" },
      { productKey: COMMERCE_PRODUCT_KEYS.SENDER_PACK, stripeSubscriptionItemId: "si_sender" },
    ]);
    expect(entitlements[ENTITLEMENT_KEYS.MANAGED_DOMAIN_ALLOWANCE]).toBe(7);
    expect(entitlements[ENTITLEMENT_KEYS.MAILBOX_ALLOWANCE]).toBe(18);
    expect(entitlements[ENTITLEMENT_KEYS.SENDER_IDENTITY_ALLOWANCE]).toBe(18);
  });
  it("enforces domain mailbox sender and monthly send allowances with override", () => {
    const e = aggregateEntitlements([{ productKey: COMMERCE_PRODUCT_KEYS.LAUNCH }]);
    expect(enforceAllowance("domain", e, 2).allowed).toBe(false);
    expect(enforceAllowance("mailbox", e, 5).allowed).toBe(true);
    expect(enforceAllowance("sender", e, 6, 1, true).reason).toBe("ADMIN_OVERRIDE");
    expect(enforceAllowance("monthlySend", e, 4500).allowed).toBe(false);
  });
  it("always blocks suppression unsubscribe complaints disabled sandbox and unready senders", () => {
    const e = aggregateEntitlements([{ productKey: COMMERCE_PRODUCT_KEYS.SEND_CAPACITY }]);
    expect(evaluateOutboundSendEligibility({ entitlements: e, sentThisPeriod: 0, suppressed: true, senderReady: true, globalSendingEnabled: true, sandboxMode: false }).allowed).toBe(false);
    expect(evaluateOutboundSendEligibility({ entitlements: e, sentThisPeriod: 0, unsubscribed: true, senderReady: true, globalSendingEnabled: true, sandboxMode: false }).blockReasons).toContain("UNSUBSCRIBED");
    expect(evaluateOutboundSendEligibility({ entitlements: e, sentThisPeriod: 0, complained: true, senderReady: true, globalSendingEnabled: true, sandboxMode: false }).blockReasons).toContain("COMPLAINT_BLOCKED");
    expect(evaluateOutboundSendEligibility({ entitlements: e, sentThisPeriod: 0, senderReady: false, globalSendingEnabled: true, sandboxMode: false }).blockReasons).toContain("SENDER_NOT_READY");
  });
  it("keeps disabled providers safe and redacts secrets", async () => {
    expect(getMailboxProvider().getProviderHealth().state).toBe("NOT_CONFIGURED");
    expect(redactSecrets({ apiKey: "abc", nested: { password: "p" } })).toEqual({ apiKey: "[REDACTED]", nested: { password: "[REDACTED]" } });
    expect(safeErrorMessage("api_key=secret password=hunter2")).not.toContain("hunter2");
    const ses = await new AwsSesTransport().sendEmail({ from: "a@example.com", to: ["b@example.com"], subject: "x" });
    expect(ses.sent).toBe(false);
  });
  it("handles idempotency, SES identity, DNS reconciliation, and sender readiness", () => {
    expect(provisionManagedMailboxPlan({ workspaceId: "w", domainName: "example.com", localPart: "sales", existingAddresses: ["sales@example.com"] }).action).toBe("noop");
    expect(ensureSesDomainIdentity("example.com").requiredRecords.length).toBeGreaterThan(0);
    expect(reconcileDns([{ type: "TXT", name: "example.com", value: "v=spf1" }], []).deleteRecords).toEqual([]);
    expect(evaluateSenderReadiness({ domainReady: true, mailboxActive: true, sesIdentityReady: false, dkimReady: true, complianceReady: true, rampReady: true, sendingEnabled: true }).blockingReasons).toContain("SES_IDENTITY_READY");
  });
});
