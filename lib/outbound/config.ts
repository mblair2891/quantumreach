import { ENTITLEMENT_KEYS, type EffectiveEntitlements } from "@/lib/sending-infrastructure/catalog";

/** Hard Instantly-style cold-outreach limits. Not SES. */
export const INBOXES_PER_DOMAIN = 3;
export const DEFAULT_INBOX_DAILY_LIMIT = 30;
export const DOMAIN_DAILY_CAP = 100;

export type SendingPackageLimits = {
  /** Maps to MANAGED_DOMAIN_ALLOWANCE (Launch 2 / Growth 5 / Scale 10). */
  maxSendingDomains: number;
  /** Maps to MAILBOX_ALLOWANCE (Launch 6 / Growth 15 / Scale 30). */
  maxInboxes: number;
  /** Optional workspace daily ceiling when DAILY_SEND_CEILING is set. */
  maxDailySends?: number;
};

export function sendingPackageLimits(entitlements: Partial<EffectiveEntitlements> | Record<string, unknown> = {}): SendingPackageLimits {
  const maxSendingDomains = Number(entitlements[ENTITLEMENT_KEYS.MANAGED_DOMAIN_ALLOWANCE] ?? 0);
  const maxInboxes = Number(entitlements[ENTITLEMENT_KEYS.MAILBOX_ALLOWANCE] ?? 0);
  const ceiling = Number(entitlements[ENTITLEMENT_KEYS.DAILY_SEND_CEILING] ?? 0);
  return {
    maxSendingDomains: Number.isFinite(maxSendingDomains) ? Math.max(0, maxSendingDomains) : 0,
    maxInboxes: Number.isFinite(maxInboxes) ? Math.max(0, maxInboxes) : 0,
    ...(ceiling > 0 ? { maxDailySends: ceiling } : {}),
  };
}

/** Domain daily cap = min(100, inboxesOnDomain * 30) unless a positive override is set. */
export function domainDailyLimit(inboxCount: number, override?: number | null) {
  const computed = Math.min(DOMAIN_DAILY_CAP, Math.max(0, inboxCount) * DEFAULT_INBOX_DAILY_LIMIT);
  if (typeof override === "number" && override > 0) return Math.min(override, computed);
  return computed;
}

export function utcDay(now = new Date()) {
  return now.toISOString().slice(0, 10);
}
