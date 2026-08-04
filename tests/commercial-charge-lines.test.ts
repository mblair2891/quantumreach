import { describe, expect, it } from "vitest";
import { buildAcquisitionChargeSummary, type CommercialChargeLine } from "@/lib/commercial/charge-lines";
import { DEFAULT_COMMERCIAL_PLANS } from "@/lib/commercial/packages";
import { catalogPrice } from "@/lib/customer-journey/acquisition-draft";
import type { CommerceProduct } from "@prisma/client";
import { readFileSync } from "node:fs";

const standard = { productKey: "STANDARD_SETUP" as const, displayName: "Standard", amountCents: 0 };
const priority = { productKey: "PRIORITY_SETUP" as const, displayName: "Head of the line", amountCents: 25000 };

describe("commercial acquisition charge lines", () => {
  it.each([
    ["LAUNCH_SENDER_PACKAGE", "Launch", 2, 6, 5000, 2, 4500, 29700, 75000, 104700, 129700],
    ["GROWTH_SENDER_PACKAGE", "Growth", 5, 15, 25000, 5, 11500, 59700, 150000, 209700, 234700],
    ["SCALE_SENDER_PACKAGE", "Scale", 10, 30, 100000, 10, 23000, 99700, 250000, 349700, 374700],
  ])("builds the authoritative %s package summary and totals", (key, name, domains, mailboxes, contacts, teamUsers, monthlySends, monthly, implementation, standardTotal, priorityTotal) => {
    const base = buildAcquisitionChargeSummary(key, standard);
    const upgraded = buildAcquisitionChargeSummary(key, priority);
    expect(base.plan).toMatchObject({ name, domains, mailboxes, contacts, teamUsers, monthlySends, monthlyCents: monthly, setupCents: implementation });
    expect(base.todayTotalCents).toBe(standardTotal);
    expect(upgraded.todayTotalCents).toBe(priorityTotal);
    expect(base.recurringMonthlyCents).toBe(monthly);
  });

  it("creates independent integer-cent lines and treats Standard as a valid zero-dollar surcharge", () => {
    const summary = buildAcquisitionChargeSummary("GROWTH_SENDER_PACKAGE", standard);
    expect(summary.todaySubtotalCents).toBe(209700);
    expect(summary.todayTotalCents).toBe(209700);
    expect(summary.lines.find(line => line.chargeType === "SETUP_PRIORITY_SURCHARGE")).toMatchObject({ unitAmountCents: 0, grossAmountCents: 0, discountAmountCents: 0, netAmountCents: 0 });
    for (const line of summary.lines) for (const amount of [line.quantity, line.unitAmountCents, line.grossAmountCents, line.discountAmountCents, line.netAmountCents]) expect(Number.isSafeInteger(amount) && amount >= 0).toBe(true);
  });

  it("calculates Growth plus Head of the line as $2,347 today and $597 monthly", () => {
    const summary = buildAcquisitionChargeSummary("GROWTH_SENDER_PACKAGE", priority);
    expect(summary.todaySubtotalCents).toBe(234700);
    expect(summary.todayTotalCents).toBe(234700);
    expect(summary.recurringMonthlyCents).toBe(59700);
  });

  it("rejects negative, fractional, and incorrect setup prices", () => {
    expect(() => buildAcquisitionChargeSummary("GROWTH_SENDER_PACKAGE", { ...priority, amountCents: -1 })).toThrow("INVALID_SETUP_PRIORITY_PRICE");
    expect(() => buildAcquisitionChargeSummary("GROWTH_SENDER_PACKAGE", { ...priority, amountCents: 25000.5 })).toThrow("INVALID_SETUP_PRIORITY_PRICE");
    expect(() => buildAcquisitionChargeSummary("GROWTH_SENDER_PACKAGE", { ...standard, amountCents: 1 })).toThrow("INVALID_SETUP_PRIORITY_PRICE");
  });

  it("keeps the package definitions unchanged", () => {
    expect(DEFAULT_COMMERCIAL_PLANS.map(plan => [plan.key, plan.monthlyCents, plan.setupCents, plan.domains, plan.mailboxes, plan.contacts, plan.teamUsers, plan.monthlySends])).toEqual([
      ["LAUNCH_SENDER_PACKAGE", 29700, 75000, 2, 6, 5000, 2, 4500],
      ["GROWTH_SENDER_PACKAGE", 59700, 150000, 5, 15, 25000, 5, 11500],
      ["SCALE_SENDER_PACKAGE", 99700, 250000, 10, 30, 100000, 10, 23000],
    ]);
  });

  it("keeps configured zero-dollar catalog pricing valid", () => {
    const setup = { recurring: false, metadata: { priceCents: 0 } } as Pick<CommerceProduct, "recurring" | "metadata">;
    expect(catalogPrice(setup)).toEqual({ recurringCents: 0, oneTimeCents: 0, configured: true });
  });

  it("renders one package-centric review without fragmented product rows", () => {
    const page = readFileSync("app/setup/confirmation/page.tsx", "utf8");
    expect(page).toContain("Quantum Reach software included");
    expect(page).toContain("Today’s total");
    expect(page).toContain("One-time implementation fee");
    expect(page).not.toContain('label="Core software"');
    expect(page).not.toContain('label="Infrastructure"');
  });
});

const _typedLine: CommercialChargeLine | undefined = undefined;
void _typedLine;
