import { redirect } from "next/navigation";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";
import { isOperatorEmail } from "@/lib/admin/operator";
export const clientPortalRoles = ["CLIENT"];
export async function requireClientPortalAccess(){ const ctx = await requireWorkspaceAccess(); if (String(ctx.membership.roleKey) !== "CLIENT") redirect("/dashboard"); return ctx; }
export async function requireSubscriberWorkspaceAccess(){ const ctx = await requireWorkspaceAccess(); if (String(ctx.membership.roleKey) === "CLIENT") redirect("/portal"); return ctx; }
export function adminBypassesLimits(email?: string | null){ return isOperatorEmail(email); }

export { canAccessClientPortal, canAccessDashboard } from "@/lib/auth/permissions";
