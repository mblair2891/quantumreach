export const COMMERCE_PRODUCT_KEYS = {
  CORE: "QUANTUM_REACH_CORE",
  AGENCY: "AGENCY_WHITE_LABEL_UPGRADE",
  LAUNCH: "LAUNCH_SENDER_PACKAGE",
  GROWTH: "GROWTH_SENDER_PACKAGE",
  SCALE: "SCALE_SENDER_PACKAGE",
  DOMAIN_PACK: "ADDITIONAL_DOMAIN_PACK",
  SENDER_PACK: "ADDITIONAL_SENDER_PACK",
  SEND_CAPACITY: "ADDITIONAL_SEND_CAPACITY",
} as const;

export const ENTITLEMENT_KEYS = {
  MANAGED_DOMAIN_ALLOWANCE: "MANAGED_DOMAIN_ALLOWANCE",
  MAILBOX_ALLOWANCE: "MAILBOX_ALLOWANCE",
  SENDER_IDENTITY_ALLOWANCE: "SENDER_IDENTITY_ALLOWANCE",
  MONTHLY_SEND_ALLOWANCE: "MONTHLY_SEND_ALLOWANCE",
  ACTIVE_OUTREACH_CONTACT_ALLOWANCE: "ACTIVE_OUTREACH_CONTACT_ALLOWANCE",
  DAILY_SEND_CEILING: "DAILY_SEND_CEILING",
  CAMPAIGN_CONCURRENCY_LIMIT: "CAMPAIGN_CONCURRENCY_LIMIT",
  WHITE_LABEL_ENABLED: "WHITE_LABEL_ENABLED",
  AFFILIATE_ENABLED: "AFFILIATE_ENABLED",
  CLIENT_WORKSPACE_RESELLING_ENABLED: "CLIENT_WORKSPACE_RESELLING_ENABLED",
} as const;

export type EntitlementKey = typeof ENTITLEMENT_KEYS[keyof typeof ENTITLEMENT_KEYS];
export type CommerceCategory = "SOFTWARE_CORE"|"SOFTWARE_UPGRADE"|"SENDING_PACKAGE"|"DOMAIN_ADDON"|"SENDER_ADDON"|"SEND_CAPACITY_ADDON"|"SETUP_FEE";
export type CatalogProduct = { key: string; name: string; category: CommerceCategory; active: boolean; recurring: boolean; sortOrder: number; entitlements: Partial<Record<EntitlementKey, number | boolean | string>>; stripeProductId?: string | null; stripePriceId?: string | null; };

export const DEFAULT_COMMERCE_CATALOG: CatalogProduct[] = [
  { key: COMMERCE_PRODUCT_KEYS.CORE, name: "Quantum Reach Core", category: "SOFTWARE_CORE", active: true, recurring: true, sortOrder: 10, entitlements: { [ENTITLEMENT_KEYS.AFFILIATE_ENABLED]: true } },
  { key: COMMERCE_PRODUCT_KEYS.AGENCY, name: "Agency / White-Label Upgrade", category: "SOFTWARE_UPGRADE", active: true, recurring: true, sortOrder: 20, entitlements: { [ENTITLEMENT_KEYS.WHITE_LABEL_ENABLED]: true, [ENTITLEMENT_KEYS.CLIENT_WORKSPACE_RESELLING_ENABLED]: true } },
  { key: COMMERCE_PRODUCT_KEYS.LAUNCH, name: "Launch Sender Package", category: "SENDING_PACKAGE", active: true, recurring: true, sortOrder: 30, entitlements: { [ENTITLEMENT_KEYS.MANAGED_DOMAIN_ALLOWANCE]: 3, [ENTITLEMENT_KEYS.MAILBOX_ALLOWANCE]: 9, [ENTITLEMENT_KEYS.SENDER_IDENTITY_ALLOWANCE]: 9 } },
  { key: COMMERCE_PRODUCT_KEYS.GROWTH, name: "Growth Sender Package", category: "SENDING_PACKAGE", active: true, recurring: true, sortOrder: 40, entitlements: { [ENTITLEMENT_KEYS.MANAGED_DOMAIN_ALLOWANCE]: 6, [ENTITLEMENT_KEYS.MAILBOX_ALLOWANCE]: 18, [ENTITLEMENT_KEYS.SENDER_IDENTITY_ALLOWANCE]: 18 } },
  { key: COMMERCE_PRODUCT_KEYS.SCALE, name: "Scale Sender Package", category: "SENDING_PACKAGE", active: true, recurring: true, sortOrder: 50, entitlements: { [ENTITLEMENT_KEYS.MANAGED_DOMAIN_ALLOWANCE]: 12, [ENTITLEMENT_KEYS.MAILBOX_ALLOWANCE]: 36, [ENTITLEMENT_KEYS.SENDER_IDENTITY_ALLOWANCE]: 36 } },
  { key: COMMERCE_PRODUCT_KEYS.DOMAIN_PACK, name: "Additional Domain Pack", category: "DOMAIN_ADDON", active: true, recurring: true, sortOrder: 60, entitlements: { [ENTITLEMENT_KEYS.MANAGED_DOMAIN_ALLOWANCE]: 1 } },
  { key: COMMERCE_PRODUCT_KEYS.SENDER_PACK, name: "Additional Sender Pack", category: "SENDER_ADDON", active: true, recurring: true, sortOrder: 70, entitlements: { [ENTITLEMENT_KEYS.MAILBOX_ALLOWANCE]: 3, [ENTITLEMENT_KEYS.SENDER_IDENTITY_ALLOWANCE]: 3 } },
  { key: COMMERCE_PRODUCT_KEYS.SEND_CAPACITY, name: "Additional Send Capacity", category: "SEND_CAPACITY_ADDON", active: true, recurring: true, sortOrder: 80, entitlements: { [ENTITLEMENT_KEYS.MONTHLY_SEND_ALLOWANCE]: 1000 } },
];

export type SubscriptionItemInput = { id?: string; stripeSubscriptionItemId?: string | null; productKey: string; quantity?: number; status?: string };
export type EffectiveEntitlements = Record<EntitlementKey, number | boolean | string>;
const numeric = new Set<EntitlementKey>([ENTITLEMENT_KEYS.MANAGED_DOMAIN_ALLOWANCE, ENTITLEMENT_KEYS.MAILBOX_ALLOWANCE, ENTITLEMENT_KEYS.SENDER_IDENTITY_ALLOWANCE, ENTITLEMENT_KEYS.MONTHLY_SEND_ALLOWANCE, ENTITLEMENT_KEYS.ACTIVE_OUTREACH_CONTACT_ALLOWANCE, ENTITLEMENT_KEYS.DAILY_SEND_CEILING, ENTITLEMENT_KEYS.CAMPAIGN_CONCURRENCY_LIMIT]);

export function aggregateEntitlements(items: SubscriptionItemInput[], catalog = DEFAULT_COMMERCE_CATALOG, overrides: Partial<EffectiveEntitlements> = {}): EffectiveEntitlements {
  const result: Partial<EffectiveEntitlements> = {};
  const seen = new Set<string>();
  for (const item of items) {
    if (item.status && !["ACTIVE", "TRIALING"].includes(item.status)) continue;
    const stableKey = item.stripeSubscriptionItemId || item.id || `${item.productKey}:implicit`;
    if (seen.has(stableKey)) continue;
    seen.add(stableKey);
    const product = catalog.find((p) => p.key === item.productKey && p.active);
    if (!product) continue;
    const quantity = Math.max(1, item.quantity ?? 1);
    for (const [key, value] of Object.entries(product.entitlements) as [EntitlementKey, number | boolean | string | undefined][]) {
      if (numeric.has(key)) result[key] = Number(result[key] || 0) + Number(value || 0) * quantity;
      else if (typeof value === "boolean") result[key] = Boolean(result[key]) || value;
      else if (value != null) result[key] = value;
    }
  }
  return { ...result, ...overrides } as EffectiveEntitlements;
}

export function remaining(allowed: number | undefined, used: number) { return Math.max(0, Number(allowed || 0) - used); }
export function pricingLabel(product: Pick<CatalogProduct, "stripePriceId">) { return product.stripePriceId ? "Configured in Stripe" : "Pricing configuration pending"; }
