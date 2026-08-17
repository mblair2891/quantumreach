import { Globe2, ShieldCheck, type LucideIcon } from "lucide-react";
import { isOperatorEmail } from "@/lib/admin/operator";
import { getOptionalUserProfile } from "@/lib/auth/rbac";

export type DashboardNavItem = readonly [string, string, LucideIcon];

export const workspaceDomainNavItem: DashboardNavItem = [
  "Sending Domains",
  "/dashboard/sending/domains",
  Globe2,
];

export const domainInventoryNavItem: DashboardNavItem = [
  "Domain Inventory",
  "/dashboard/admin/domains",
  ShieldCheck,
];

export async function getAuthorizedDomainNavItems(): Promise<DashboardNavItem[]> {
  const user = await getOptionalUserProfile();
  const email = user?.email;
  return isOperatorEmail(email) ? [domainInventoryNavItem] : [];
}
