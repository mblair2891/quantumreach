import { ENTITLEMENT_KEYS } from "@/lib/sending-infrastructure/catalog";

export const FULL_PLATFORM_MODULES = ["CRM", "contacts", "companies", "leads", "opportunities", "pipeline", "tasks", "outreach", "managed sending", "meetings", "transcripts", "analysis", "proposals", "contracts", "client onboarding", "projects", "deliverables", "client portal", "reports", "guided workflows"] as const;

export type CommercialPlan = { key: string; slug: string; name: string; description: string; targetCustomer: string; monthlyCents: number; setupCents: number; currency: "USD"; domains: number; mailboxes: number; contacts: number; teamUsers: number; monthlySends: number; dailySends: number; onboarding: string; support: string; recommended: boolean; version: number; effectiveAt: string; cogsRangeCents: [number, number] };

export const DEFAULT_COMMERCIAL_PLANS: CommercialPlan[] = [
  { key: "LAUNCH_SENDER_PACKAGE", slug: "launch", name: "Launch", description: "Build your first repeatable client-acquisition system.", targetCustomer: "Founders creating a repeatable acquisition motion", monthlyCents: 29700, setupCents: 75000, currency: "USD", domains: 2, mailboxes: 6, contacts: 5000, teamUsers: 2, monthlySends: 4500, dailySends: 210, onboarding: "Standard", support: "Standard", recommended: false, version: 1, effectiveAt: "2026-07-29T00:00:00.000Z", cogsRangeCents: [3200, 5700] },
  { key: "GROWTH_SENDER_PACKAGE", slug: "growth", name: "Growth", description: "Run consistent outbound and manage a growing pipeline.", targetCustomer: "Growing teams running consistent outbound", monthlyCents: 59700, setupCents: 150000, currency: "USD", domains: 5, mailboxes: 15, contacts: 25000, teamUsers: 5, monthlySends: 11500, dailySends: 525, onboarding: "Priority", support: "Priority", recommended: true, version: 1, effectiveAt: "2026-07-29T00:00:00.000Z", cogsRangeCents: [8100, 14300] },
  { key: "SCALE_SENDER_PACKAGE", slug: "scale", name: "Scale", description: "Operate multiple campaigns, team members, and a larger client-acquisition engine.", targetCustomer: "Established teams scaling multiple campaigns", monthlyCents: 99700, setupCents: 250000, currency: "USD", domains: 10, mailboxes: 30, contacts: 100000, teamUsers: 10, monthlySends: 23000, dailySends: 1050, onboarding: "Expedited", support: "Strategic", recommended: false, version: 1, effectiveAt: "2026-07-29T00:00:00.000Z", cogsRangeCents: [16800, 29800] },
];

export const DEFAULT_ADDONS = [
  { key: "ADDITIONAL_MANAGED_DOMAIN", name: "Additional managed .com domain", recurring: true, interval: "YEAR", priceCents: 7500, entitlements: { [ENTITLEMENT_KEYS.MANAGED_DOMAIN_ALLOWANCE]: 1 } },
  { key: "ADDITIONAL_DOMAIN_SETUP", name: "Additional domain setup", recurring: false, interval: "ONE_TIME", priceCents: 12500, entitlements: {} },
  { key: "ADDITIONAL_MAILBOX", name: "Additional 10 GB mailbox", recurring: true, interval: "MONTH", priceCents: 1500, entitlements: { [ENTITLEMENT_KEYS.MAILBOX_ALLOWANCE]: 1 } },
  { key: "ADDITIONAL_DOMAIN_THREE_MAILBOXES", name: "Additional domain plus three mailboxes", recurring: true, interval: "MONTH", priceCents: 5900, entitlements: { [ENTITLEMENT_KEYS.MANAGED_DOMAIN_ALLOWANCE]: 1, [ENTITLEMENT_KEYS.MAILBOX_ALLOWANCE]: 3 } },
  { key: "ADDITIONAL_5000_SENDS", name: "Additional 5,000 monthly sends", recurring: true, interval: "MONTH", priceCents: 3500, entitlements: { [ENTITLEMENT_KEYS.MONTHLY_SEND_ALLOWANCE]: 5000 } },
  { key: "ADDITIONAL_TEAM_USER", name: "Additional team user", recurring: true, interval: "MONTH", priceCents: 2500, entitlements: { TEAM_USER_ALLOWANCE: 1 } },
  { key: "ADDITIONAL_25000_CONTACTS", name: "Additional 25,000 CRM contacts", recurring: true, interval: "MONTH", priceCents: 5000, entitlements: { [ENTITLEMENT_KEYS.ACTIVE_OUTREACH_CONTACT_ALLOWANCE]: 25000 } },
  { key: "ADDITIONAL_10GB_STORAGE", name: "Additional 10 GB storage", recurring: true, interval: "MONTH", priceCents: 1000, entitlements: { STORAGE_GB_ALLOWANCE: 10 } },
  { key: "DOMAIN_REPLACEMENT", name: "Domain replacement and reconfiguration", recurring: false, interval: "ONE_TIME", priceCents: 12500, entitlements: {} },
  { key: "EXPEDITED_PROVISIONING", name: "Expedited provisioning", recurring: false, interval: "ONE_TIME", priceCents: 50000, entitlements: {} },
] as const;

export type SetupPriorityProduct = {
  key: "STANDARD_SETUP" | "PRIORITY_SETUP";
  name: string;
  description: string;
  category: "SETUP_FEE";
  active: true;
  recurring: false;
  billingInterval: "ONE_TIME";
  oneTimePriceCents: number;
  sortOrder: number;
};

/** Optional acquisition queue-priority surcharges. Package implementation fees
 * remain part of the selected Launch, Growth, or Scale package. */
export const DEFAULT_SETUP_PRODUCTS: readonly SetupPriorityProduct[] = [
  { key: "STANDARD_SETUP", name: "Standard", description: "Normal setup queue with no additional charge.", category: "SETUP_FEE", active: true, recurring: false, billingInterval: "ONE_TIME", oneTimePriceCents: 0, sortOrder: 10 },
  { key: "PRIORITY_SETUP", name: "Head of the line", description: "Priority queue placement for a $250 one-time surcharge. Compliance, safety, provider, deliverability, and warm-up requirements still apply.", category: "SETUP_FEE", active: true, recurring: false, billingInterval: "ONE_TIME", oneTimePriceCents: 25000, sortOrder: 20 },
] as const;

export function planEntitlements(plan: CommercialPlan) { return { [ENTITLEMENT_KEYS.MANAGED_DOMAIN_ALLOWANCE]: plan.domains, [ENTITLEMENT_KEYS.MAILBOX_ALLOWANCE]: plan.mailboxes, [ENTITLEMENT_KEYS.SENDER_IDENTITY_ALLOWANCE]: plan.mailboxes, [ENTITLEMENT_KEYS.MONTHLY_SEND_ALLOWANCE]: plan.monthlySends, [ENTITLEMENT_KEYS.ACTIVE_OUTREACH_CONTACT_ALLOWANCE]: plan.contacts, TEAM_USER_ALLOWANCE: plan.teamUsers, DAILY_DOMAIN_CAPACITY: 105, DAILY_MAILBOX_CAPACITY: 35, COMPLETE_PLATFORM_INCLUDED: true }; }

export function snapshotAcceptedTerms(plan: CommercialPlan, addons: { key: string; quantity: number; unitPriceCents: number }[] = []) { if (!DEFAULT_COMMERCIAL_PLANS.some(p => p.key === plan.key) || plan.monthlyCents < 0 || plan.setupCents < 0) throw new Error("INVALID_COMMERCIAL_PLAN"); return Object.freeze({ planKey: plan.key, planVersion: plan.version, acceptedAt: new Date().toISOString(), currency: plan.currency, monthlyCents: plan.monthlyCents, setupCents: plan.setupCents, limits: planEntitlements(plan), addons: addons.map(a => ({ ...a })), catalogSnapshot: { name: plan.name, description: plan.description, onboarding: plan.onboarding, support: plan.support } }); }

export function projectedEconomics(plan: CommercialPlan, practicalCogsCents = plan.cogsRangeCents[1]) { const grossProfitCents = plan.monthlyCents - practicalCogsCents; return { label: "Planning estimate", projectedCogsCents: practicalCogsCents, grossProfitCents, grossMarginPercent: plan.monthlyCents ? Math.round(grossProfitCents / plan.monthlyCents * 10000) / 100 : 0 }; }
