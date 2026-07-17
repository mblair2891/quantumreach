export const SAAS_UNAVAILABLE = "Unavailable until Stripe data is connected";
export const subscriberTypes = ["STUDENT", "DIRECT_CUSTOMER", "AFFILIATE_RESELLER", "REFERRED_CLIENT_COMPANY"] as const;
export const skoolStatuses = ["UNKNOWN", "ACTIVE", "INACTIVE", "CANCELED", "MANUALLY_VERIFIED"] as const;
export const planKeys = ["STARTER", "PROFESSIONAL", "AGENCY", "ENTERPRISE"] as const;
export const subscriptionStatuses = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "UNPAID", "INCOMPLETE"] as const;
export const provisioningStatuses = ["PENDING", "RUNNING", "COMPLETED", "FAILED", "RETRYING"] as const;
export const affiliateStatuses = ["PENDING", "ACTIVE", "SUSPENDED", "TERMINATED"] as const;
export const commissionTypes = ["PERCENT_RECURRING", "PERCENT_ONE_TIME", "FIXED_ONE_TIME"] as const;
export const commissionStatuses = ["PENDING", "APPROVED", "PAYABLE", "PAID", "REVERSED", "VOID"] as const;
export const workspaceTypes = ["INTERNAL", "STUDENT_SUBSCRIBER", "DIRECT_CUSTOMER", "REFERRED_CLIENT_COMPANY"] as const;
export const clientPortalDistinction = {
  CLIENT_COMPANY_SUBSCRIBER: "Full SaaS workspace tenant using /dashboard with isolated CRM, campaigns, billing, branding, and team data.",
  CLIENT_PORTAL_USER: "Limited external project/client access using /portal only; never a SaaS workspace owner by implication.",
} as const;
export const saasEntitlements = ["CRM","CONTACT_IMPORTS","BULK_EMAIL","MANAGED_DOMAINS","SCHEDULING","MEETINGS","AI_ANALYSIS","PROPOSALS","CONTRACTS","ESIGN","CLIENT_PORTALS","AFFILIATE_PROGRAM","WHITE_LABEL","CLIENT_WORKSPACE_RESELLING"] as const;
export const saasLimits = ["contacts","users","campaigns","monthlySends","domains","senderIdentities","aiUsage","meetingHours","storage","contracts","researchRuns","clientPortals","clientCompanyWorkspaces"] as const;
export function isSelfReferral(affiliateUserId: string, prospectUserId?: string | null) { return Boolean(prospectUserId && affiliateUserId === prospectUserId); }
export function calculateCommissionCents(input:{type: typeof commissionTypes[number]; rateBps?: number; fixedCents?: number; grossCents: number}) {
  if (input.grossCents <= 0) return 0;
  if (input.type === "FIXED_ONE_TIME") return Math.max(0, input.fixedCents ?? 0);
  return Math.floor((input.grossCents * Math.max(0, input.rateBps ?? 0)) / 10_000);
}
export function stripeReady(env: NodeJS.ProcessEnv = process.env) { return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET); }
export function abbreviatedStripeId(id?: string | null) { return id ? `${id.slice(0, 7)}…${id.slice(-4)}` : "Not connected"; }
