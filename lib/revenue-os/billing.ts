/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
const publicPrefixes = ["/", "/sign-in", "/sign-up", "/api/webhooks/zoom", "/api/webhooks/stripe", "/api/billing/webhook", "/api/health", "/unsubscribe", "/book", "/sign"];
export function getAdminEmails() { return (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean); }
export function isPublicRevenueRoute(pathname: string) { return publicPrefixes.some((p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`))); }
export function isBillingEnabled() { return process.env.BILLING_ENABLED === "true"; }
export async function getWorkspaceAccessDecision(workspaceId: string, userEmail: string, pathname = "/dashboard") {
  if (isPublicRevenueRoute(pathname)) return { allowed: true, reason: "public_route" };
  if (!isBillingEnabled()) return { allowed: true, reason: "billing_disabled" };
  if (getAdminEmails().includes(userEmail.toLowerCase())) return { allowed: true, reason: "admin_bypass" };
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) return { allowed: false, reason: "stripe_not_configured" };
  const sub = await (prisma as any).workspaceSubscription.findUnique({ where: { workspaceId } });
  return ["ACTIVE", "TRIALING"].includes(sub?.status) ? { allowed: true, reason: "subscription_active" } : { allowed: false, reason: "subscription_required" };
}
