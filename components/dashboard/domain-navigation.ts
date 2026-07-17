import { currentUser } from "@clerk/nextjs/server";
import { Globe2, ShieldCheck, type LucideIcon } from "lucide-react";
import { isOperatorEmail } from "@/lib/admin/operator";

export type DashboardNavItem = readonly [string, string, LucideIcon];

export const workspaceDomainNavItem: DashboardNavItem = [
  "Sending Domains",
  "/dashboard/sending-domains",
  Globe2,
];

export const domainInventoryNavItem: DashboardNavItem = [
  "Domain Inventory",
  "/dashboard/admin/domains",
  ShieldCheck,
];

export async function getAuthorizedDomainNavItems(): Promise<DashboardNavItem[]> {
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;
  return isOperatorEmail(email) ? [domainInventoryNavItem] : [];
}
