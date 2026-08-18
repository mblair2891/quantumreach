import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { COMMERCE_PRODUCT_KEYS, DEFAULT_COMMERCE_CATALOG, ENTITLEMENT_KEYS, aggregateEntitlements } from "@/lib/sending-infrastructure/catalog";
import { planEntitlements, DEFAULT_COMMERCIAL_PLANS } from "@/lib/commercial/packages";

const db = {
  saasWorkspaceProfile: { findUnique: vi.fn(), upsert: vi.fn() },
  managedDomain: { create: vi.fn(), findUnique: vi.fn() },
};
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));

const source = (path: string) => readFileSync(path, "utf8");

describe("core brand domain vs sending packages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.saasWorkspaceProfile.upsert.mockResolvedValue({ workspaceId: "w1", coreDomainMode: "BYO", coreDomainName: "acme.com" });
  });

  it("saves a BYO core hostname without creating sending-domain or DNS jobs", async () => {
    const { saveWorkspaceCoreDomain } = await import("@/lib/workspaces/core-domain");
    const saved = await saveWorkspaceCoreDomain({ workspaceId: "w1", mode: "BYO", domainName: "https://Acme.com/path" });
    expect(saved).toEqual({ mode: "BYO", domainName: "acme.com" });
    expect(db.saasWorkspaceProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "w1" },
        create: expect.objectContaining({ coreDomainMode: "BYO", coreDomainName: "acme.com" }),
        update: { coreDomainMode: "BYO", coreDomainName: "acme.com" },
      }),
    );
    expect(db.managedDomain.create).not.toHaveBeenCalled();
    expect(db.managedDomain.findUnique).not.toHaveBeenCalled();
  });

  it("lets a workspace skip core domain without blocking sending setup", async () => {
    const { saveWorkspaceCoreDomain } = await import("@/lib/workspaces/core-domain");
    db.saasWorkspaceProfile.upsert.mockResolvedValue({ workspaceId: "w1", coreDomainMode: "NONE", coreDomainName: null });
    await expect(saveWorkspaceCoreDomain({ workspaceId: "w1", mode: "NONE" })).resolves.toEqual({ mode: "NONE", domainName: null });
    expect(db.managedDomain.create).not.toHaveBeenCalled();
  });

  it("records the add-on path without allocating a sending-domain slot", async () => {
    const { saveWorkspaceCoreDomain } = await import("@/lib/workspaces/core-domain");
    db.saasWorkspaceProfile.upsert.mockResolvedValue({ workspaceId: "w1", coreDomainMode: "MANAGED_ADDON", coreDomainName: null });
    await saveWorkspaceCoreDomain({ workspaceId: "w1", mode: "MANAGED_ADDON" });
    expect(db.saasWorkspaceProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { coreDomainMode: "MANAGED_ADDON", coreDomainName: null },
      }),
    );
    expect(db.managedDomain.create).not.toHaveBeenCalled();
  });

  it("keeps Launch/Growth/Scale entitlements sending-only", () => {
    for (const key of [COMMERCE_PRODUCT_KEYS.LAUNCH, COMMERCE_PRODUCT_KEYS.GROWTH, COMMERCE_PRODUCT_KEYS.SCALE]) {
      const product = DEFAULT_COMMERCE_CATALOG.find((row) => row.key === key);
      expect(product?.entitlements[ENTITLEMENT_KEYS.MANAGED_DOMAIN_ALLOWANCE]).toBeGreaterThan(0);
      expect(product?.entitlements[ENTITLEMENT_KEYS.CORE_BRAND_DOMAIN]).toBeUndefined();
      const aggregated = aggregateEntitlements([{ productKey: key }]);
      expect(aggregated[ENTITLEMENT_KEYS.CORE_BRAND_DOMAIN]).toBeUndefined();
    }
    for (const plan of DEFAULT_COMMERCIAL_PLANS) {
      expect(planEntitlements(plan)).not.toHaveProperty(ENTITLEMENT_KEYS.CORE_BRAND_DOMAIN);
    }
    const addon = DEFAULT_COMMERCE_CATALOG.find((row) => row.key === COMMERCE_PRODUCT_KEYS.CORE_DOMAIN_ADDON);
    expect(addon?.entitlements).toEqual({ [ENTITLEMENT_KEYS.CORE_BRAND_DOMAIN]: 1 });
    expect(addon?.entitlements[ENTITLEMENT_KEYS.MANAGED_DOMAIN_ALLOWANCE]).toBeUndefined();
  });

  it("distinguishes core vs sending in onboarding, pricing, and package lists", () => {
    const onboarding = source("app/dashboard/onboarding/page.tsx");
    const start = source("app/start/page.tsx");
    const pricing = source("app/pricing/page.tsx");
    const sending = source("app/dashboard/sending/domains/page.tsx");
    expect(onboarding).toContain("Do you already have a main business domain");
    expect(onboarding).toContain("We won’t transfer or change this domain");
    expect(onboarding).toContain("Sending domains & outreach mailboxes");
    expect(onboarding).not.toContain("primary domain included");
    expect(start).toContain("Sending domains & outreach mailboxes");
    expect(start).toContain("Your main website / admin-support domain is not included");
    expect(start).not.toContain("includes your company domain");
    expect(pricing).toContain("Sending domains & outreach mailboxes");
    expect(pricing).toContain("main business website domain is not included");
    expect(sending).toContain("not your main company website domain");
  });
});
