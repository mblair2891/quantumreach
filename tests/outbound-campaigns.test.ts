import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { StubOutboundProvider } from "@/lib/outbound/providers";

const entitlements = vi.hoisted(() =>
  vi.fn(async () => ({
    effective: { MANAGED_DOMAIN_ALLOWANCE: 2, MAILBOX_ALLOWANCE: 6 },
  })),
);
const gates = vi.hoisted(() => ({ managedSendingEnabled: true }));

const inboxes = [
  {
    id: "inb_a",
    workspaceId: "w1",
    sendingDomainId: "dom_1",
    emailAddress: "a@outreach.example.com",
    displayName: "A",
    status: "ACTIVE",
    health: "HEALTHY",
    dailyLimit: 30,
    lastSentAt: null as Date | null,
    createdAt: new Date("2026-01-01"),
    domain: { id: "dom_1", domain: "outreach.example.com", dailyCapOverride: null },
  },
  {
    id: "inb_b",
    workspaceId: "w1",
    sendingDomainId: "dom_1",
    emailAddress: "b@outreach.example.com",
    displayName: "B",
    status: "ACTIVE",
    health: "HEALTHY",
    dailyLimit: 30,
    lastSentAt: null as Date | null,
    createdAt: new Date("2026-01-02"),
    domain: { id: "dom_1", domain: "outreach.example.com", dailyCapOverride: null },
  },
];

const db = vi.hoisted(() => ({
  outboundList: { findFirst: vi.fn(), create: vi.fn() },
  outboundCampaign: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  outboundCampaignJob: { upsert: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  inbox: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), update: vi.fn() },
  sendLog: { count: vi.fn(), create: vi.fn() },
  contact: { findUnique: vi.fn() },
  suppressionListEntry: { findFirst: vi.fn(), create: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/sending-infrastructure/operational", () => ({ getWorkspaceEffectiveEntitlements: entitlements }));
vi.mock("@/lib/sending-infrastructure/gates", () => ({ getSendingGates: () => gates }));

const source = (path: string) => readFileSync(path, "utf8");

const campaign = {
  id: "cmp_1",
  workspaceId: "w1",
  listId: "list_1",
  name: "April",
  status: "running",
  inboxPool: { type: "all" },
  fromName: "Ada",
  subject: "Hi {{FirstName}}",
  body: "Hello {{FirstName}} at {{Email}}",
  list: {
    members: [
      { contactId: "c1", contact: { id: "c1", email: "one@x.com", firstName: "One", lastName: "A" } },
      { contactId: "c2", contact: { id: "c2", email: "two@x.com", firstName: "Two", lastName: "B" } },
    ],
  },
};

describe("outbound campaign send path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gates.managedSendingEnabled = true;
    inboxes[0].lastSentAt = null;
    inboxes[1].lastSentAt = null;
    inboxes[0].health = "HEALTHY";
    inboxes[1].health = "HEALTHY";
    inboxes[0].status = "ACTIVE";
    inboxes[1].status = "ACTIVE";
    db.inbox.findMany.mockImplementation(async () =>
      [...inboxes].sort((a, b) => (a.lastSentAt?.getTime() ?? 0) - (b.lastSentAt?.getTime() ?? 0) || a.createdAt.getTime() - b.createdAt.getTime()),
    );
    db.inbox.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => inboxes.find((row) => row.id === where.id) ?? null);
    db.inbox.count.mockResolvedValue(2);
    db.inbox.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = inboxes.find((inbox) => inbox.id === where.id);
      if (row) Object.assign(row, data);
      return row;
    });
    db.suppressionListEntry.create.mockResolvedValue({});
    db.sendLog.count.mockResolvedValue(0);
    db.sendLog.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: `log_${String(data.inboxId)}`, ...data }));
    db.suppressionListEntry.findFirst.mockResolvedValue(null);
    db.outboundCampaign.findUnique.mockResolvedValue(campaign);
    db.outboundCampaign.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...campaign, ...data }));
    db.outboundCampaignJob.update.mockResolvedValue({});
    db.outboundCampaignJob.count.mockResolvedValue(0);
    db.contact.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      const member = campaign.list.members.find((row) => row.contactId === where.id);
      return member?.contact ?? null;
    });
  });

  it("applies FirstName and Email merge tags", async () => {
    const { applyMergeTags } = await import("@/lib/outbound/campaigns");
    expect(applyMergeTags("Hi {{FirstName}} <{{Email}}>", { firstName: "Ada", email: "ada@x.com" })).toBe("Hi Ada <ada@x.com>");
  });

  it("skips suppressed contacts at enqueue and never records a send", async () => {
    db.outboundCampaign.findFirst.mockResolvedValue({ ...campaign, status: "draft" });
    db.suppressionListEntry.findFirst.mockImplementation(async ({ where }: { where: { email: string } }) =>
      where.email === "one@x.com" ? { id: "sup" } : null,
    );
    db.outboundCampaignJob.upsert.mockResolvedValue({});
    const { startOutreachCampaign } = await import("@/lib/outbound/campaigns");
    await startOutreachCampaign("cmp_1", "w1", db as never);
    expect(db.outboundCampaignJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ email: "one@x.com", status: "skipped", skipReason: "SUPPRESSED" }),
      }),
    );
    expect(db.outboundCampaignJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ email: "two@x.com", status: "queued" }),
      }),
    );
  });

  it("rotates across healthy inboxes and does not use SES", async () => {
    db.outboundCampaignJob.findMany.mockResolvedValue([
      { id: "j1", campaignId: "cmp_1", contactId: "c1", email: "one@x.com", status: "queued" },
      { id: "j2", campaignId: "cmp_1", contactId: "c2", email: "two@x.com", status: "queued" },
    ]);
    const { processCampaignBatch } = await import("@/lib/outbound/campaigns");
    const result = await processCampaignBatch("cmp_1", { db: db as never, provider: new StubOutboundProvider() });
    expect(result.sent).toBe(2);
    const inboxIds = db.outboundCampaignJob.update.mock.calls.map((call: { data?: { inboxId?: string; status?: string } }[]) => {
      const args = call[0] as { data: { inboxId?: string; status?: string } };
      return args.data.status === "sent" ? args.data.inboxId : null;
    }).filter(Boolean);
    expect(new Set(inboxIds).size).toBe(2);
    expect(source("lib/outbound/campaigns.ts")).not.toContain("@aws-sdk/client-ses");
    expect(source("lib/outbound/providers.ts")).not.toContain("@aws-sdk/client-ses");
    expect(source("lib/outbound/providers.ts")).toContain("StubOutboundProvider");
    expect(source("lib/outbound/providers.ts")).toContain("GOOGLE_OAUTH_NOT_CONNECTED");
  });

  it("does not double-send the same contact and campaign step", async () => {
    db.outboundCampaign.findFirst.mockResolvedValue({ ...campaign, status: "draft" });
    db.outboundCampaignJob.upsert.mockResolvedValue({});
    const { startOutreachCampaign } = await import("@/lib/outbound/campaigns");
    await startOutreachCampaign("cmp_1", "w1", db as never);
    expect(db.outboundCampaignJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campaignId_contactId: { campaignId: "cmp_1", contactId: "c1" } },
        update: {},
      }),
    );
  });

  it("refuses to start when managed sending is disabled", async () => {
    gates.managedSendingEnabled = false;
    const { startOutreachCampaign } = await import("@/lib/outbound/campaigns");
    await expect(startOutreachCampaign("cmp_1", "w1", db as never)).rejects.toThrow("MANAGED_SENDING_ENABLED");
  });

  it("skips unhealthy inboxes after Google disconnect", async () => {
    inboxes[0].health = "UNHEALTHY";
    db.outboundCampaignJob.findMany.mockResolvedValue([
      { id: "j1", campaignId: "cmp_1", contactId: "c1", email: "one@x.com", status: "queued" },
    ]);
    const { processCampaignBatch } = await import("@/lib/outbound/campaigns");
    const result = await processCampaignBatch("cmp_1", { db: db as never, provider: new StubOutboundProvider() });
    expect(result.sent).toBe(1);
    expect(db.outboundCampaignJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "sent", inboxId: "inb_b" }) }),
    );
  });

  it("suppresses bounce-like Google failures", async () => {
    db.outboundCampaignJob.findMany.mockResolvedValue([
      { id: "j1", campaignId: "cmp_1", contactId: "c1", email: "one@x.com", status: "queued" },
    ]);
    const provider = { id: "google", send: vi.fn(async () => ({ ok: false, provider: "google", reason: "BOUNCE_LIKE" })) };
    const { processCampaignBatch } = await import("@/lib/outbound/campaigns");
    const result = await processCampaignBatch("cmp_1", { db: db as never, provider: provider as never });
    expect(result.skipped).toBe(1);
    expect(db.suppressionListEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "one@x.com", reason: "HARD_BOUNCE" }) }),
    );
    expect(db.outboundCampaignJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "skipped", skipReason: "BOUNCE_LIKE" }) }),
    );
  });

  it("marks the inbox unhealthy when Google auth is revoked", async () => {
    db.outboundCampaignJob.findMany.mockResolvedValue([
      { id: "j1", campaignId: "cmp_1", contactId: "c1", email: "one@x.com", status: "queued" },
    ]);
    const provider = { id: "google", send: vi.fn(async () => ({ ok: false, provider: "google", reason: "AUTH_REVOKED" })) };
    const { processCampaignBatch } = await import("@/lib/outbound/campaigns");
    await processCampaignBatch("cmp_1", { db: db as never, provider: provider as never });
    expect(db.inbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ health: "UNHEALTHY", googleConnectionStatus: "REVOKED" }),
      }),
    );
    expect(db.outboundCampaignJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "retry", skipReason: "AUTH_REVOKED" }) }),
    );
  });

  it("pauses when no inbox has remaining capacity", async () => {
    db.sendLog.count.mockResolvedValue(30);
    db.outboundCampaignJob.findMany.mockResolvedValue([
      { id: "j1", campaignId: "cmp_1", contactId: "c1", email: "one@x.com", status: "queued" },
    ]);
    const { processCampaignBatch } = await import("@/lib/outbound/campaigns");
    const result = await processCampaignBatch("cmp_1", { db: db as never, provider: new StubOutboundProvider() });
    expect(result.paused).toBe(true);
    expect(db.outboundCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "paused", pauseReason: "NO_INBOX_CAPACITY" }) }),
    );
  });
});
