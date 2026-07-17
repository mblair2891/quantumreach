import { describe, expect, it } from "vitest";
import { platformNavigation, workspaceNavigation, clientPortalNavigation } from "@/lib/saas/navigation";
import { canAccessClientPortal, canAccessDashboard, adminBypassesLimits } from "@/lib/saas/access";
import { isWithinEntitlement, planEntitlements } from "@/lib/saas/entitlements";
function labels(sections: {items:{label:string}[]}[]){ return sections.flatMap((s)=>s.items.map((i)=>i.label)); }
function hrefs(sections: {items:{href:string}[]}[]){ return sections.flatMap((s)=>s.items.map((i)=>i.href)); }
describe("SaaS persona boundaries",()=>{
 it("platform navigation differs from subscriber navigation",()=>{ expect(hrefs(platformNavigation).every((h)=>h.startsWith("/platform"))).toBe(true); expect(hrefs(workspaceNavigation).every((h)=>h.startsWith("/dashboard"))).toBe(true); });
 it("subscriber navigation hides operator controls and keeps sending domains",()=>{ const nav=labels(workspaceNavigation); expect(nav).not.toContain("Operator"); expect(nav).not.toContain("Platform Admin"); expect(nav).not.toContain("Domain Inventory"); expect(nav).toContain("Sending Domains"); });
 it("platform exposes domain inventory concepts including wholesale cost",()=>{ const nav=labels(platformNavigation); expect(nav).toContain("Managed Domains"); expect(hrefs(platformNavigation)).toContain("/platform/domains"); });
 it("client portal navigation excludes subscriber internals",()=>{ const nav=labels(clientPortalNavigation); expect(nav).toContain("Projects"); expect(nav).toContain("Contracts"); expect(nav).not.toContain("CRM"); expect(nav).not.toContain("Sending Domains"); expect(nav).not.toContain("Billing"); });
 it("client role is portal-only",()=>{ expect(canAccessDashboard("CLIENT")).toBe(false); expect(canAccessClientPortal("CLIENT")).toBe(true); expect(canAccessDashboard("ADMIN")).toBe(true); });
 it("entitlements support limits and admin bypass",()=>{ expect(planEntitlements.STARTER.contacts).toBeGreaterThan(0); expect(isWithinEntitlement("STARTER","contacts",999999,false)).toBe(false); expect(isWithinEntitlement("STARTER","contacts",999999,true)).toBe(true); });
 it("ADMIN_EMAILS bypass helper recognizes configured operators",()=>{ process.env.ADMIN_EMAILS="owner@example.com"; expect(adminBypassesLimits("owner@example.com")).toBe(true); expect(adminBypassesLimits("subscriber@example.com")).toBe(false); });
});
