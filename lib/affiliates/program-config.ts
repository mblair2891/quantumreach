import { prisma } from "@/lib/db/prisma";

export type AffiliateProgramConfigValues = {
  id: string;
  enabled: boolean;
  firstPaymentRateBps: number;
  recurringRateBps: number;
  setupFeesCommissionable: boolean;
  holdDays: number;
  notes: string | null;
};

export const DEFAULT_AFFILIATE_PROGRAM_CONFIG: AffiliateProgramConfigValues = {
  id: "default",
  enabled: true,
  firstPaymentRateBps: 2000,
  recurringRateBps: 1000,
  setupFeesCommissionable: false,
  holdDays: 14,
  notes: null,
};

function clampBps(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10_000, Math.floor(value)));
}

function clampDays(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(365, Math.floor(value)));
}

/** Ensures the singleton config row exists and returns it. */
export async function getAffiliateProgramConfig(): Promise<AffiliateProgramConfigValues> {
  const row = await prisma.affiliateProgramConfig.upsert({
    where: { id: "default" },
    create: { ...DEFAULT_AFFILIATE_PROGRAM_CONFIG },
    update: {},
  });
  return {
    id: row.id,
    enabled: row.enabled,
    firstPaymentRateBps: row.firstPaymentRateBps,
    recurringRateBps: row.recurringRateBps,
    setupFeesCommissionable: row.setupFeesCommissionable,
    holdDays: row.holdDays,
    notes: row.notes,
  };
}

export type UpdateAffiliateProgramConfigInput = {
  enabled: boolean;
  firstPaymentRateBps: number;
  recurringRateBps: number;
  setupFeesCommissionable: boolean;
  holdDays: number;
  notes?: string | null;
};

export async function updateAffiliateProgramConfig(input: UpdateAffiliateProgramConfigInput) {
  return prisma.affiliateProgramConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      enabled: Boolean(input.enabled),
      firstPaymentRateBps: clampBps(input.firstPaymentRateBps),
      recurringRateBps: clampBps(input.recurringRateBps),
      setupFeesCommissionable: Boolean(input.setupFeesCommissionable),
      holdDays: clampDays(input.holdDays),
      notes: input.notes?.trim() || null,
    },
    update: {
      enabled: Boolean(input.enabled),
      firstPaymentRateBps: clampBps(input.firstPaymentRateBps),
      recurringRateBps: clampBps(input.recurringRateBps),
      setupFeesCommissionable: Boolean(input.setupFeesCommissionable),
      holdDays: clampDays(input.holdDays),
      notes: input.notes?.trim() || null,
    },
  });
}

export function formatBpsAsPercent(bps: number) {
  return `${(Math.max(0, bps) / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}
