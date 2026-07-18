import { describe, expect, it } from "vitest";
import { aggregateEntitlements, DEFAULT_COMMERCE_CATALOG, ENTITLEMENT_KEYS } from "@/lib/sending-infrastructure/catalog";
import { enforceAllowance, evaluateOutboundSendEligibility, evaluateSenderReadiness } from "@/lib/sending-infrastructure/readiness";
import { provisionManagedMailboxPlan } from "@/lib/sending-infrastructure/provisioning";
import { reconcileDns, desiredEmailDnsRecords } from "@/lib/sending-infrastructure/dns";
import { getProviderReadiness } from "@/lib/sending-infrastructure/providers";
import { currentBillingPeriod, senderReadinessFromRecords } from "@/lib/sending-infrastructure/operational";

describe("operational sending infrastructure", () => {
  it("resolves effective entitlements from active database-shaped subscription items and deduplicates subscription items", () => {
    const entitlements = aggregateEntitlements([
      { id: "a", stripeSubscriptionItemId: "si_1", productKey: "GROWTH_SENDER_PACKAGE", quantity: 1, status: "ACTIVE" },
      { id: "b", stripeSubscriptionItemId: "si_1", productKey: "GROWTH_SENDER_PACKAGE", quantity: 1, status: "ACTIVE" },
      { id: "c", productKey: "ADDITIONAL_SEND_CAPACITY", quantity: 2, status: "ACTIVE" },
      { id: "d", productKey: "SCALE_SENDER_PACKAGE", quantity: 1, status: "CANCELED" },
    ], DEFAULT_COMMERCE_CATALOG, { [ENTITLEMENT_KEYS.DAILY_SEND_CEILING]: 50 });
    expect(entitlements.MANAGED_DOMAIN_ALLOWANCE).toBe(6);
    expect(entitlements.MAILBOX_ALLOWANCE).toBe(18);
    expect(entitlements.MONTHLY_SEND_ALLOWANCE).toBe(2000);
    expect(entitlements.DAILY_SEND_CEILING).toBe(50);
  });

  it("prevents duplicate mailbox requests and validates local parts", () => {
    const plan = provisionManagedMailboxPlan({ workspaceId: "w1", domainName: "example.com", localPart: "hello", existingAddresses: ["hello@example.com"] });
    expect(plan.action).toBe("noop");
    expect(() => provisionManagedMailboxPlan({ workspaceId: "w1", domainName: "example.com", localPart: "bad space", existingAddresses: [] })).toThrow();
  });

  it("enforces workspace allowance and blocks disabled sending paths before provider calls", () => {
    const entitlements = { [ENTITLEMENT_KEYS.MAILBOX_ALLOWANCE]: 1, [ENTITLEMENT_KEYS.MONTHLY_SEND_ALLOWANCE]: 1 } as any;
    expect(enforceAllowance("mailbox", entitlements, 1).allowed).toBe(false);
    const eligibility = evaluateOutboundSendEligibility({ entitlements, sentThisPeriod: 0, senderReady: true, globalSendingEnabled: false, sandboxMode: false });
    expect(eligibility.allowed).toBe(false);
    expect(eligibility.blockReasons).toContain("EMAIL_SENDING_DISABLED");
  });

  it("uses real DNS comparison and sender records for readiness instead of fabricated metrics", () => {
    const desired = desiredEmailDnsRecords("example.com");
    expect(reconcileDns(desired, []).missingRecords).toHaveLength(desired.length);
    const readiness = senderReadinessFromRecords({ sesIdentityState: "PENDING", dkimState: "PENDING", sendingEnabled: false }, { status: "PENDING_PROVIDER_CONFIGURATION" }, { lifecycleStatus: "ACTIVE", sesIdentity: { verificationStatus: "PENDING", dkimStatus: "PENDING" }, warmupPlan: { status: "NOT_STARTED" } });
    expect(readiness.ready).toBe(false);
    expect(readiness.blockingReasons).toContain("MAILBOX_ACTIVE");
  });

  it("reports provider-disabled state truthfully and computes billing period boundaries", () => {
    expect(getProviderReadiness().mailbox.state).toBe("NOT_CONFIGURED");
    const period = currentBillingPeriod(new Date("2026-07-18T12:00:00.000Z"));
    expect(period.periodStart.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(period.periodEnd.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });
});
