import { describe, expect, it } from "vitest";
import { DEFAULT_COMMERCIAL_PLANS, DEFAULT_SETUP_PRODUCTS } from "@/lib/commercial/packages";
import { bootstrapCommerceCatalog } from "@/lib/sending-infrastructure/operational";
import { catalogPrice, setupProductKeys } from "@/lib/customer-journey/acquisition-draft";
import { readFileSync } from "node:fs";

type Row = Record<string, any> & { key: string; id: string; metadata: Record<string, unknown> };
function memoryCatalog(seed: Row[] = []) {
  const rows = new Map(seed.map((row) => [row.key, { ...row }]));
  let next = 1;
  const db = {
    commerceProduct: {
      findUnique: async ({ where }: any) => rows.get(where.key) ?? null,
      upsert: async ({ where, update, create }: any) => {
        const current = rows.get(where.key);
        const saved = current ? { ...current, ...update } : { id: `p${next++}`, stripeProductId: null, stripePriceId: null, stripeSetupPriceId: null, ...create };
        rows.set(where.key, saved);
        return saved;
      },
    },
    commerceProductEntitlement: { upsert: async () => ({}) },
  };
  return { db: db as any, rows };
}

describe("setup-priority catalog bootstrap", () => {
  it("defines the three exact active one-time setup products in deterministic order", () => {
    expect(DEFAULT_SETUP_PRODUCTS.map((p) => p.key)).toEqual(Object.values(setupProductKeys));
    expect(DEFAULT_SETUP_PRODUCTS.map((p) => p.sortOrder)).toEqual([10, 20, 30]);
    for (const product of DEFAULT_SETUP_PRODUCTS) {
      expect(product).toMatchObject({ category: "SETUP_FEE", active: true, recurring: false, billingInterval: "ONE_TIME" });
      expect(product.oneTimePriceCents).toBeGreaterThan(0);
    }
    expect(DEFAULT_SETUP_PRODUCTS.find((p) => p.key === "EXPEDITED_SETUP")?.key).not.toBe("EXPEDITED_PROVISIONING");
  });

  it("bootstraps setup products idempotently while preserving mappings and unrelated metadata", async () => {
    const { db, rows } = memoryCatalog([{ id: "existing", key: "PRIORITY_SETUP", name: "Old", metadata: { priceCents: 33300, operatorNote: "preserve" }, stripeProductId: "prod_keep", stripePriceId: "price_keep", stripeSetupPriceId: "price_setup_keep" }]);
    await bootstrapCommerceCatalog(db);
    await bootstrapCommerceCatalog(db);
    const setup = [...rows.values()].filter((row) => Object.values(setupProductKeys).includes(row.key as any));
    expect(setup).toHaveLength(3);
    expect(setup.map((row) => row.key)).toEqual(expect.arrayContaining(Object.values(setupProductKeys)));
    for (const row of setup) {
      expect(row).toMatchObject({ category: "SETUP_FEE", active: true, recurring: false, billingInterval: "ONE_TIME" });
      expect(catalogPrice(row as any).oneTimeCents).toBeGreaterThan(0);
    }
    expect(rows.get("PRIORITY_SETUP")).toMatchObject({ stripeProductId: "prod_keep", stripePriceId: "price_keep", stripeSetupPriceId: "price_setup_keep", metadata: { priceCents: 33300, setupPriorityProduct: true, operatorNote: "preserve" } });
    expect(catalogPrice(rows.get("PRIORITY_SETUP") as any).oneTimeCents).toBe(33300);
  });

  it("keeps Launch Growth and Scale defaults unchanged", () => {
    expect(DEFAULT_COMMERCIAL_PLANS.map(({ key, monthlyCents, setupCents, domains, mailboxes }) => ({ key, monthlyCents, setupCents, domains, mailboxes }))).toEqual([
      { key: "LAUNCH_SENDER_PACKAGE", monthlyCents: 29700, setupCents: 75000, domains: 2, mailboxes: 6 },
      { key: "GROWTH_SENDER_PACKAGE", monthlyCents: 59700, setupCents: 150000, domains: 5, mailboxes: 15 },
      { key: "SCALE_SENDER_PACKAGE", monthlyCents: 99700, setupCents: 250000, domains: 10, mailboxes: 30 },
    ]);
  });

  it("renders three persisted choices and a safe incomplete-catalog state", () => {
    const page = readFileSync("app/setup/priority/page.tsx", "utf8");
    expect(page).toContain("Object.values(setupProductKeys).every");
    expect(page).toContain("Setup options are temporarily unavailable.");
    expect(page).toContain("CATALOG_SETUP_OPTIONS_MISSING");
    expect(page).toContain('href="/start"');
    expect(page).toContain("products.map");
  });

  it("persists every supported priority and reviews its persisted product name and price", () => {
    const action = readFileSync("app/setup/priority/actions.ts", "utf8");
    const confirmation = readFileSync("app/setup/confirmation/page.tsx", "utf8");
    expect(action).toContain("setupProductKeys[priority]");
    expect(action).toContain("saveDraftSelection({ setupPriority: priority })");
    expect(action).toContain('redirect("/setup/confirmation")');
    expect(confirmation).toContain('label="Setup priority" value={selection.setup.name}');
    expect(confirmation).toContain('label="Priority price"');
    expect(confirmation).toContain("Nothing has been charged or provisioned");
  });

  it("keeps initialization for an empty catalog and exposes synchronization for a populated catalog", () => {
    const page = readFileSync("app/platform/catalog/page.tsx", "utf8");
    expect(page).toContain('products.length > 0 && <CatalogBootstrap label="Sync Default Catalog" mode="sync" />');
    expect(page).toContain("products.length===0?");
    expect(page).toContain("<CatalogBootstrap />");
    expect(page).toContain("Create Product");
    expect(page).toContain("form action={saveProductAction}");
  });

  it("uses the shared protected action with mode-specific synchronization confirmation", () => {
    const component = readFileSync("components/platform/catalog-bootstrap.tsx", "utf8");
    const action = readFileSync("app/platform/catalog/actions.ts", "utf8");
    const page = readFileSync("app/platform/catalog/page.tsx", "utf8");
    expect(component).toContain('mode?: "initialize" | "sync"');
    expect(component).toContain("Sync the default Quantum Reach product catalog?");
    expect(component).toContain("This adds missing default products and refreshes safe catalog defaults. Existing Stripe mappings and operator-entered metadata are preserved. No Stripe prices will be created.");
    expect(component).toContain('submit: "Sync catalog"');
    expect(component).toContain("form action={bootstrapCatalogAction}");
    expect(action).toContain("await requireOperatorAccess()");
    expect(action).toContain("await bootstrapCommerceCatalog()");
    expect((component.match(/export function CatalogBootstrap/g) ?? [])).toHaveLength(1);
    expect(page).toContain('import { CatalogBootstrap } from "@/components/platform/catalog-bootstrap"');
    expect(page).not.toContain("function CatalogBootstrap");
  });
});
