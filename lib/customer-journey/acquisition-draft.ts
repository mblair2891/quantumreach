import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import type { CommerceProduct, Prisma } from "@prisma/client";

export const acquisitionCookie = "qr_acquisition";
export type CustomerSetupPriority = "STANDARD" | "PRIORITY";
export const setupProductKeys: Record<CustomerSetupPriority, string> = {
  STANDARD: "STANDARD_SETUP", PRIORITY: "PRIORITY_SETUP",
};

export type DraftSelection = { coreProductId?: string; infrastructureProductId?: string; setupPriority?: CustomerSetupPriority; returnRoute?: string };
export type CatalogPrice = { recurringCents: number; oneTimeCents: number; configured: boolean };

function record(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function readDraft(metadata: Prisma.JsonValue): DraftSelection {
  const value = record(metadata).acquisitionDraft;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const draft = value as Record<string, unknown>;
  return {
    coreProductId: typeof draft.coreProductId === "string" ? draft.coreProductId : undefined,
    infrastructureProductId: typeof draft.infrastructureProductId === "string" ? draft.infrastructureProductId : undefined,
    setupPriority: ["STANDARD", "PRIORITY"].includes(String(draft.setupPriority)) ? draft.setupPriority as DraftSelection["setupPriority"] : undefined,
    returnRoute: typeof draft.returnRoute === "string" ? draft.returnRoute : undefined,
  };
}

export function catalogPrice(product: Pick<CommerceProduct, "recurring" | "metadata">): CatalogPrice {
  const metadata = record(product.metadata);
  const recurring = cents(metadata.recurringPriceCents ?? metadata.priceCents ?? metadata.unitAmountCents);
  const oneTime = cents(metadata.setupFeeCents ?? metadata.oneTimePriceCents ?? (!product.recurring ? metadata.priceCents : undefined));
  const keys = product.recurring ? ["recurringPriceCents", "priceCents", "unitAmountCents"] : ["setupFeeCents", "oneTimePriceCents", "priceCents"];
  const configured = keys.some(key => typeof metadata[key] === "number" && Number.isInteger(metadata[key]) && Number(metadata[key]) >= 0);
  return { recurringCents: product.recurring ? recurring : 0, oneTimeCents: oneTime, configured };
}

function cents(value: unknown) { return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0; }
export function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100); }

export async function getDraftSession(id?: string) {
  const anonymousId = id ?? cookies().get(acquisitionCookie)?.value;
  return anonymousId ? prisma.acquisitionSession.findUnique({ where: { anonymousId } }) : null;
}

export async function saveDraftSelection(update: Partial<DraftSelection>) {
  const jar = cookies();
  const anonymousId = jar.get(acquisitionCookie)?.value ?? randomUUID();
  const existing = await prisma.acquisitionSession.findUnique({ where: { anonymousId } });
  const previous = existing ? readDraft(existing.metadata) : {};
  const acquisitionDraft = { ...previous, ...update };
  const metadata = { ...record(existing?.metadata), acquisitionDraft } as Prisma.InputJsonValue;
  const session = await prisma.acquisitionSession.upsert({ where: { anonymousId }, create: { anonymousId, landingPage: "/start", metadata }, update: { metadata } });
  jar.set(acquisitionCookie, anonymousId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 60 });
  return session;
}

export async function loadValidatedDraft(id?: string) {
  const session = await getDraftSession(id);
  if (!session) throw new Error("Your package selection could not be found. Please start again.");
  const draft = readDraft(session.metadata);
  if (!draft.coreProductId || !draft.infrastructureProductId || !draft.setupPriority) throw new Error("Complete each package-selection step before continuing.");
  const [core, infrastructure, setup] = await Promise.all([
    prisma.commerceProduct.findFirst({ where: { id: draft.coreProductId, category: "SOFTWARE_CORE", active: true }, include: { entitlements: true } }),
    prisma.commerceProduct.findFirst({ where: { id: draft.infrastructureProductId, category: "SENDING_PACKAGE", active: true }, include: { entitlements: true } }),
    prisma.commerceProduct.findFirst({ where: { key: setupProductKeys[draft.setupPriority], category: "SETUP_FEE", active: true }, include: { entitlements: true } }),
  ]);
  if (!core || !infrastructure || !setup) throw new Error("A selected package is no longer available. Please review your selections.");
  return { session, draft, core, infrastructure, setup };
}

export function summarizeDraft(products: { core: CommerceProduct; infrastructure: CommerceProduct; setup: CommerceProduct }) {
  const core = catalogPrice(products.core), infrastructure = catalogPrice(products.infrastructure), setup = catalogPrice(products.setup);
  return { core, infrastructure, setup, recurringCents: core.recurringCents + infrastructure.recurringCents + setup.recurringCents, oneTimeCents: core.oneTimeCents + infrastructure.oneTimeCents + setup.oneTimeCents };
}
