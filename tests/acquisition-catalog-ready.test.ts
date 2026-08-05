import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { catalogPrice } from "@/lib/customer-journey/acquisition-draft";

const source = (path: string) => readFileSync(path, "utf8");

describe("acquisition catalog readiness", () => {
  it("shows package prices from metadata even when recurring flag is missing", () => {
    const price = catalogPrice({
      recurring: false,
      metadata: { recurringPriceCents: 59700, setupFeeCents: 150000 },
    } as any);
    expect(price).toEqual({ recurringCents: 59700, oneTimeCents: 150000, configured: true });
  });

  it("self-heals catalog on public funnel entry points", () => {
    expect(source("app/start/page.tsx")).toContain("ensureAcquisitionCatalogReady");
    expect(source("app/setup/priority/page.tsx")).toContain("ensureAcquisitionCatalogReady");
    expect(source("lib/sending-infrastructure/operational.ts")).toContain("ensureAcquisitionCatalogReady");
    expect(source("lib/sending-infrastructure/operational.ts")).toContain("recurringPriceCents: plan.monthlyCents");
  });
});
