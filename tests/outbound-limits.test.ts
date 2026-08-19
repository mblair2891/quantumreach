import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_INBOX_DAILY_LIMIT,
  DOMAIN_DAILY_CAP,
  INBOXES_PER_DOMAIN,
  domainDailyLimit,
  sendingPackageLimits,
} from "@/lib/outbound/config";
import { COMMERCE_PRODUCT_KEYS, DEFAULT_COMMERCE_CATALOG, ENTITLEMENT_KEYS, aggregateEntitlements } from "@/lib/sending-infrastructure/catalog";

const entitlements = vi.hoisted(() =>
  vi.fn(async () => ({
    effective: { MANAGED_DOMAIN_ALLOWANCE: 2, MAILBOX_ALLOWANCE: 6 },
  })),
);
const coreDomain = vi.hoisted(() => vi.fn(async () => ({ mode: "NONE" as const, domainName: null })));

const db = {
  sendingDomain: { count: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  inbox: { count: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  sendLog: { count: vi.fn(), create: vi.fn() },
  contact: { findFirst: vi.fn(), create: vi.fn() },
  suppressionListEntry: { findFirst: vi.fn() },
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/sending-infrastructure/operational", () => ({ getWorkspaceEffectiveEntitlements: entitlements }));
vi.mock("@/lib/workspaces/core-domain", async () => {
  const actual = await vi.importActual<typeof import("@/lib/workspaces/core-domain")>("@/lib/workspaces/core-domain");
  return { ...actual, getWorkspaceCoreDomain: coreDomain };
});

const source = (path: string) => readFileSync(path, "utf8");

const domain = {
  id: "dom_1",
  workspaceId: "w1",
  domain: "outreach.example.com",
  dailyCapOverride: null,
};
const inbox = {
  id: "inb_1",
  workspaceId: "w1",
  sendingDomainId: "dom_1",
  localPart: "hello",
  emailAddress: "hello@outreach.example.com",
  status: "ACTIVE",
  health: "HEALTHY",
  dailyLimit: 30,
  domain,
};

describe("Instantly-style outbound limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entitlements.mockResolvedValue({ effective: { MANAGED_DOMAIN_ALLOWANCE: 2, MAILBOX_ALLOWANCE: 6 } });
    coreDomain.mockResolvedValue({ mode: "NONE", domainName: null });
    db.sendingDomain.count.mockResolvedValue(0);
    db.sendingDomain.findUnique.mockResolvedValue(null);
    db.sendingDomain.findFirst.mockResolvedValue(domain);
    db.sendingDomain.create.mockImplementation(async ({ data }) => ({ id: "dom_1", ...data }));
    db.inbox.count.mockResolvedValue(0);
    db.inbox.findUnique.mockResolvedValue(null);
    db.inbox.create.mockImplementation(async ({ data }) => ({ id: "inb_new", ...data }));
    db.sendLog.count.mockResolvedValue(0);
    db.sendLog.create.mockImplementation(async ({ data }) => ({ id: "log_1", ...data }));
    db.contact.findFirst.mockResolvedValue(null);
    db.contact.create.mockImplementation(async ({ data }) => ({ id: "c1", ...data }));
    db.suppressionListEntry.findFirst.mockResolvedValue(null);
  });

  it("maps package entitlements to maxSendingDomains and maxInboxes", () => {
    for (const key of [COMMERCE_PRODUCT_KEYS.LAUNCH, COMMERCE_PRODUCT_KEYS.GROWTH, COMMERCE_PRODUCT_KEYS.SCALE]) {
      const product = DEFAULT_COMMERCE_CATALOG.find((row) => row.key === key);
      const limits = sendingPackageLimits(aggregateEntitlements([{ productKey: key }]));
      expect(limits.maxSendingDomains).toBe(product?.entitlements[ENTITLEMENT_KEYS.MANAGED_DOMAIN_ALLOWANCE]);
      expect(limits.maxInboxes).toBe(product?.entitlements[ENTITLEMENT_KEYS.MAILBOX_ALLOWANCE]);
      expect(product?.entitlements[ENTITLEMENT_KEYS.CORE_BRAND_DOMAIN]).toBeUndefined();
    }
    expect(INBOXES_PER_DOMAIN).toBe(3);
    expect(DEFAULT_INBOX_DAILY_LIMIT).toBe(30);
    expect(DOMAIN_DAILY_CAP).toBe(100);
    expect(domainDailyLimit(1)).toBe(30);
    expect(domainDailyLimit(3)).toBe(90);
    expect(domainDailyLimit(4)).toBe(100);
    expect(domainDailyLimit(3, 40)).toBe(40);
  });

  it("rejects a 4th inbox on one sending domain", async () => {
    db.inbox.count.mockImplementation(async ({ where }) => (where.sendingDomainId ? 3 : 3));
    const { addInbox } = await import("@/lib/outbound/service");
    await expect(addInbox({ workspaceId: "w1", sendingDomainId: "dom_1", localPart: "four" })).rejects.toThrow(
      "at most 3 inboxes",
    );
    expect(db.inbox.create).not.toHaveBeenCalled();
  });

  it("enforces package maxInboxes across domains", async () => {
    entitlements.mockResolvedValue({ effective: { MANAGED_DOMAIN_ALLOWANCE: 2, MAILBOX_ALLOWANCE: 2 } });
    db.inbox.count.mockImplementation(async ({ where }) => (where.sendingDomainId ? 0 : 2));
    const { addInbox } = await import("@/lib/outbound/service");
    await expect(addInbox({ workspaceId: "w1", sendingDomainId: "dom_1", localPart: "hello" })).rejects.toThrow(
      "allows 2 inboxes",
    );
  });

  it("rejects attaching an inbox to the BYO core domain", async () => {
    coreDomain.mockResolvedValue({ mode: "BYO", domainName: "acme.com" });
    db.sendingDomain.findFirst.mockResolvedValue({ ...domain, domain: "acme.com" });
    const { addInbox } = await import("@/lib/outbound/service");
    await expect(addInbox({ workspaceId: "w1", sendingDomainId: "dom_1", localPart: "hello" })).rejects.toThrow(
      "main business domain",
    );
  });

  it("blocks the 31st stub send on the same inbox the same UTC day", async () => {
    db.inbox.findUnique.mockResolvedValue(inbox);
    db.sendLog.count.mockImplementation(async ({ where }) => (where.inboxId ? 30 : 0));
    const { canSend, stubSend } = await import("@/lib/outbound/service");
    await expect(canSend("inb_1")).resolves.toMatchObject({ allowed: false, reason: "INBOX_DAILY_LIMIT" });
    const result = await stubSend({ inboxId: "inb_1", toEmail: "prospect@example.com" });
    expect(result.ok).toBe(false);
    expect(result.blockReason).toBe("INBOX_DAILY_LIMIT");
    expect(db.sendLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "BLOCKED", blockReason: "INBOX_DAILY_LIMIT" }) }),
    );
  });

  it("blocks when the domain cap is reached across inboxes", async () => {
    db.inbox.findUnique.mockResolvedValue({ ...inbox, domain: { ...domain, dailyCapOverride: 40 } });
    db.inbox.count.mockResolvedValue(2);
    db.sendLog.count.mockImplementation(async ({ where }) => {
      if (where.inboxId) return 10;
      if (where.sendingDomainId) return 40;
      return 0;
    });
    const { canSend } = await import("@/lib/outbound/service");
    await expect(canSend("inb_1")).resolves.toMatchObject({ allowed: false, reason: "DOMAIN_DAILY_CAP" });
  });

  it("imports contact CSV rows", async () => {
    const { importContactsCsv } = await import("@/lib/outbound/service");
    const result = await importContactsCsv({
      workspaceId: "w1",
      csv: "email,firstName,lastName\nada@example.com,Ada,Lovelace\n",
    });
    expect(result.created).toBe(1);
    expect(db.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "ada@example.com", firstName: "Ada" }) }),
    );
  });

  it("wires a stub send path that does not call SES", () => {
    const service = source("lib/outbound/service.ts");
    expect(service).toContain("stub sent");
    expect(service).not.toContain("lib/sending-infrastructure/ses");
    expect(source("app/dashboard/sending/outbound/page.tsx")).toContain("does not use SES");
    expect(source("app/api/outbound/send/route.ts")).toContain("stubSend");
  });
});
