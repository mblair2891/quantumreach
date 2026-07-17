import { describe, expect, it } from "vitest";
import { platformNavigation } from "@/lib/saas/navigation";
import { ATTRIBUTION_POLICY, canAttribute, commissionForSuccessfulPayment, reversalForRefund } from "@/lib/saas-commerce/affiliate";
import { clientPortalDistinction, SAAS_UNAVAILABLE, saasEntitlements } from "@/lib/saas-commerce/platform-model";
import { provisionSubscriberWorkspace } from "@/lib/saas-commerce/provisioning";

describe("SaaS commerce platform boundaries", () => {
  it("platform navigation excludes consulting workspace workflows", () => {
    const labels = platformNavigation.flatMap((s) => s.items.map((i) => i.label.toLowerCase()));
    expect(labels.join(" ")).not.toMatch(/meeting|crm|proposal|contract|project/);
    expect(labels).toContain("subscribers");
    expect(labels).toContain("affiliates");
    expect(labels).toContain("commissions");
  });
  it("documents unavailable Stripe metrics instead of fabricating revenue", () => { expect(SAAS_UNAVAILABLE).toMatch(/Stripe data/); });
  it("blocks self-referral and duplicate conversion abuse", () => {
    expect(canAttribute({ affiliateUserId: "u1", prospectUserId: "u1" })).toBe(false);
    expect(canAttribute({ affiliateUserId: "u1", prospectUserId: "u2", existingConversion: true })).toBe(false);
    expect(ATTRIBUTION_POLICY).toMatch(/Last-touch/);
  });
  it("creates and reverses commissions from successful eligible payments only", () => {
    expect(commissionForSuccessfulPayment(10_000, 2000)).toBe(2_000);
    expect(reversalForRefund(2_000, 5_000, 10_000)).toBe(-1_000);
    expect(commissionForSuccessfulPayment(0, 2000)).toBe(0);
  });
  it("provisioning is idempotency-keyed by subscriber and subscription", async () => {
    const input = { userId: "user_1", email: "owner@example.com", subscriptionId: "sub_1", planKey: "AGENCY", subscriberType: "REFERRED_CLIENT_COMPANY" };
    await expect(provisionSubscriberWorkspace(input)).resolves.toMatchObject({ workspaceId: "subscriber:user_1:subscription:sub_1", status: "COMPLETED" });
    await expect(provisionSubscriberWorkspace(input)).resolves.toMatchObject({ workspaceId: "subscriber:user_1:subscription:sub_1" });
  });
  it("keeps client company subscribers distinct from portal users", () => {
    expect(clientPortalDistinction.CLIENT_COMPANY_SUBSCRIBER).toMatch(/Full SaaS workspace/);
    expect(clientPortalDistinction.CLIENT_PORTAL_USER).toMatch(/\/portal only/);
  });
  it("white-label is an entitlement, not a global default", () => { expect(saasEntitlements).toContain("WHITE_LABEL"); });
});
