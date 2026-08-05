import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { CommerceProduct } from "@prisma/client";
import { catalogPrice, money, readDraft, setupProductKeys, summarizeDraft } from "@/lib/customer-journey/acquisition-draft";

const product = (overrides: Partial<CommerceProduct> = {}): CommerceProduct => ({ id: "p", key: "CORE", name: "Core", description: null, category: "SENDING_PACKAGE", active: true, recurring: true, billingInterval: "MONTH", stripeProductId: null, stripePriceId: null, stripeSetupPriceId: null, commissionCategory: null, metadata: { recurringPriceCents: 9900, setupFeeCents: 25000 }, sortOrder: 0, createdAt: new Date(), updatedAt: new Date(), ...overrides });
const source = (path: string) => readFileSync(path, "utf8");

describe("public acquisition flow", () => {
  it("reads only safe selection identifiers from acquisition metadata", () => expect(readDraft({ acquisitionDraft: { coreProductId: "core", infrastructureProductId: "infra", setupPriority: "STANDARD", injectedPrice: 1 } })).toEqual({ coreProductId: "core", infrastructureProductId: "infra", setupPriority: "STANDARD", returnRoute: undefined }));
  it("rejects non-customer persisted priority values", () => { expect(readDraft({ acquisitionDraft: { setupPriority: "MANUAL_HOLD" } }).setupPriority).toBeUndefined(); expect(readDraft({ acquisitionDraft: { setupPriority: "EXPEDITED" } }).setupPriority).toBeUndefined(); });
  it("resolves recurring and one-time pricing from server catalog metadata", () => expect(catalogPrice(product())).toEqual({ recurringCents: 9900, oneTimeCents: 25000, configured: true }));
  it("does not invent missing catalog prices", () => expect(catalogPrice(product({ metadata: {} }))).toEqual({ recurringCents: 0, oneTimeCents: 0, configured: false }));
  it("separates expected one-time and recurring totals", () => expect(summarizeDraft({ core: product(), infrastructure: product({ metadata: { recurringPriceCents: 2000 } }), setup: product({ recurring: false, metadata: { priceCents: 5000 } }) })).toMatchObject({ recurringCents: 11900, oneTimeCents: 30000 }));
  it("formats catalog cents without trusting browser display values", () => expect(money(12345)).toBe("$123.45"));
  it("maps only supported customer setup priorities", () => expect(setupProductKeys).toEqual({ STANDARD: "STANDARD_SETUP", PRIORITY: "PRIORITY_SETUP" }));
  it("shows active core catalog products before authentication", () => { const text = source("app/start/page.tsx"); expect(text).toContain('category: "SENDING_PACKAGE", active: true'); expect(text).not.toContain("/sign-up"); });
  it("persists infrastructure and priority before review", () => { expect(source("app/setup/infrastructure/actions.ts")).toContain("infrastructureProductId"); expect(source("app/setup/priority/actions.ts")).toContain("setupPriority"); });
  it("offers pay-first checkout without forcing pre-payment account creation", () => {
    const text = source("app/setup/confirmation/page.tsx");
    expect(text).toContain("submitGuestCheckoutAction");
    expect(text).toContain("Pay first");
    expect(text).not.toContain("Create account and continue");
    expect(text).toContain("Sign in");
  });
  it("creates guest orders without a user id and authenticated finalize still exists", () => {
    expect(source("lib/customer-journey/service.ts")).toContain("createGuestAcquisitionOrder");
    expect(source("lib/customer-journey/service.ts")).toContain("userId: null");
    expect(source("app/join/page.tsx")).toContain("finalizeAcquisitionOrder(user.id, resume)");
  });
  it("keeps submitted guest and auth orders unpaid without provisioning a workspace", () => {
    const text = source("lib/customer-journey/service.ts");
    const guest = text.slice(text.indexOf("export async function createGuestAcquisitionOrder"), text.indexOf("export async function finalizeAcquisitionOrder"));
    expect(guest).toContain('paymentStatus: "UNPAID"');
    expect(guest).not.toContain("workspace.create");
  });
});
