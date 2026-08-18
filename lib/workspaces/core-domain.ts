import "server-only";
import { prisma } from "@/lib/db/prisma";

/** Core brand domain is website/admin identity. Sending packages never include this. */
export const CORE_DOMAIN_MODES = ["NONE", "BYO", "MANAGED_ADDON"] as const;
export type CoreDomainMode = (typeof CORE_DOMAIN_MODES)[number];

export type WorkspaceCoreDomain = {
  mode: CoreDomainMode;
  domainName: string | null;
};

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function normalizeCoreDomainName(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
}

export function isCoreDomainMode(value: unknown): value is CoreDomainMode {
  return typeof value === "string" && (CORE_DOMAIN_MODES as readonly string[]).includes(value);
}

export function parseCoreDomainMode(value: unknown): CoreDomainMode {
  return isCoreDomainMode(value) ? value : "NONE";
}

/** True when a Stripe Price is mapped. Missing price means the add-on path is request-only. */
export function isCoreDomainAddonPriced() {
  return Boolean(process.env.STRIPE_PRICE_CORE_DOMAIN_ADDON?.trim());
}

export function displayCoreDomainMode(mode: CoreDomainMode) {
  if (mode === "BYO") return "Your main business domain (optional reference — not used for outreach sending)";
  if (mode === "MANAGED_ADDON") return "Core brand domain (optional) — website & admin/support identity";
  return "No core brand domain on file";
}

export async function getWorkspaceCoreDomain(workspaceId: string): Promise<WorkspaceCoreDomain> {
  const profile = await prisma.saasWorkspaceProfile.findUnique({ where: { workspaceId } });
  return {
    mode: parseCoreDomainMode(profile?.coreDomainMode),
    domainName: profile?.coreDomainName?.trim() || null,
  };
}

/**
 * Persist core-domain choice only. Must not create ManagedDomain, DNS, SES, mailbox,
 * transfer, or warmup records — those belong to sending domains.
 */
export async function saveWorkspaceCoreDomain(input: {
  workspaceId: string;
  mode: CoreDomainMode;
  domainName?: string | null;
}): Promise<WorkspaceCoreDomain> {
  const mode = parseCoreDomainMode(input.mode);
  let domainName: string | null = null;
  if (mode === "BYO") {
    domainName = normalizeCoreDomainName(input.domainName ?? "");
    if (!DOMAIN_RE.test(domainName)) throw new Error("Enter a valid domain like example.com.");
  } else if (mode === "MANAGED_ADDON" && input.domainName) {
    domainName = normalizeCoreDomainName(input.domainName);
    if (domainName && !DOMAIN_RE.test(domainName)) throw new Error("Enter a valid domain like example.com.");
  }

  await prisma.saasWorkspaceProfile.upsert({
    where: { workspaceId: input.workspaceId },
    create: {
      workspaceId: input.workspaceId,
      workspaceType: "DIRECT_CUSTOMER",
      coreDomainMode: mode,
      coreDomainName: domainName,
    },
    update: { coreDomainMode: mode, coreDomainName: domainName },
  });

  return { mode, domainName };
}
