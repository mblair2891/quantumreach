import type { CommerceBillingInterval } from "@prisma/client";
import { DEFAULT_COMMERCIAL_PLANS, type CommercialPlan } from "./packages";

export const COMMERCIAL_CHARGE_TYPES = ["PACKAGE_FIRST_MONTH", "PACKAGE_RECURRING", "IMPLEMENTATION_FEE", "SETUP_PRIORITY_SURCHARGE", "ADDON_ONE_TIME", "ADDON_RECURRING", "TAX", "PASS_THROUGH_FEE"] as const;
export type CommercialChargeType = typeof COMMERCIAL_CHARGE_TYPES[number];

export type CommercialChargeLine = {
  lineKey: string;
  productKey: string;
  displayName: string;
  chargeType: CommercialChargeType;
  quantity: number;
  unitAmountCents: number;
  grossAmountCents: number;
  discountAmountCents: number;
  netAmountCents: number;
  recurring: boolean;
  billingInterval: CommerceBillingInterval;
  taxClassification: "DIGITAL_SERVICE" | "IMPLEMENTATION_SERVICE" | "SURCHARGE" | "ADDON" | "TAX" | "PASS_THROUGH";
  passThroughClassification: "NONE" | "PROVIDER" | "GOVERNMENT";
  sourcePackageKey: string;
  sourceCatalogVersion: number;
  dueToday: boolean;
};

export type AcquisitionChargeSummary = {
  plan: CommercialPlan;
  lines: CommercialChargeLine[];
  todaySubtotalCents: number;
  todayTotalCents: number;
  recurringMonthlyCents: number;
};

type SetupSelection = { productKey: "STANDARD_SETUP" | "PRIORITY_SETUP"; displayName: string; amountCents: number };

function line(input: Omit<CommercialChargeLine, "grossAmountCents" | "discountAmountCents" | "netAmountCents">): CommercialChargeLine {
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || !Number.isSafeInteger(input.unitAmountCents) || input.unitAmountCents < 0) throw new Error("INVALID_CHARGE_LINE_AMOUNT");
  const grossAmountCents = input.quantity * input.unitAmountCents;
  if (!Number.isSafeInteger(grossAmountCents) || grossAmountCents < 0) throw new Error("INVALID_CHARGE_LINE_AMOUNT");
  return { ...input, grossAmountCents, discountAmountCents: 0, netAmountCents: grossAmountCents };
}

export function buildAcquisitionChargeSummary(packageKey: string, setup: SetupSelection): AcquisitionChargeSummary {
  const plan = DEFAULT_COMMERCIAL_PLANS.find(candidate => candidate.key === packageKey);
  if (!plan) throw new Error("INVALID_COMMERCIAL_PLAN");
  if (setup.productKey === "STANDARD_SETUP" && setup.amountCents !== 0) throw new Error("INVALID_SETUP_PRIORITY_PRICE");
  if (setup.productKey === "PRIORITY_SETUP" && setup.amountCents !== 25000) throw new Error("INVALID_SETUP_PRIORITY_PRICE");
  const common = { quantity: 1, sourcePackageKey: plan.key, sourceCatalogVersion: plan.version, passThroughClassification: "NONE" as const };
  const lines: CommercialChargeLine[] = [
    line({ ...common, lineKey: `${plan.key}:first-month`, productKey: plan.key, displayName: `${plan.name} first month`, chargeType: "PACKAGE_FIRST_MONTH", unitAmountCents: plan.monthlyCents, recurring: false, billingInterval: "ONE_TIME", taxClassification: "DIGITAL_SERVICE", dueToday: true }),
    line({ ...common, lineKey: `${plan.key}:recurring`, productKey: plan.key, displayName: `${plan.name} recurring monthly fee`, chargeType: "PACKAGE_RECURRING", unitAmountCents: plan.monthlyCents, recurring: true, billingInterval: "MONTH", taxClassification: "DIGITAL_SERVICE", dueToday: false }),
    line({ ...common, lineKey: `${plan.key}:implementation`, productKey: plan.key, displayName: `${plan.name} implementation`, chargeType: "IMPLEMENTATION_FEE", unitAmountCents: plan.setupCents, recurring: false, billingInterval: "ONE_TIME", taxClassification: "IMPLEMENTATION_SERVICE", dueToday: true }),
    line({ ...common, lineKey: `${setup.productKey}:surcharge`, productKey: setup.productKey, displayName: setup.displayName, chargeType: "SETUP_PRIORITY_SURCHARGE", unitAmountCents: setup.amountCents, recurring: false, billingInterval: "ONE_TIME", taxClassification: "SURCHARGE", dueToday: true }),
  ];
  const todaySubtotalCents = lines.filter(item => item.dueToday).reduce((sum, item) => sum + item.netAmountCents, 0);
  if (!Number.isSafeInteger(todaySubtotalCents) || todaySubtotalCents < 0) throw new Error("INVALID_CHARGE_TOTAL");
  return { plan, lines, todaySubtotalCents, todayTotalCents: todaySubtotalCents, recurringMonthlyCents: plan.monthlyCents };
}
