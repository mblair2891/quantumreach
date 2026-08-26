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
  outboundCampaign: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  outboundCampaignJob: { upsert: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  inbox: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), update: vi.fn() },
  sendLog: { count: vi.fn(), create: vi.fn() },
  contact: { findUnique: vi.fn() },
  suppressionListEntry: { findFirst: vi.fn(), create: vi.fn() },
  workspace: { findUnique: vi.fn() },
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
  body: "Hello {{FirstName}} at {{Email}}\n{{unsubscribe_url}}",
  workspace: {
    id: "w1",
    name: "Acme",
    legalName: "Acme Inc",
    physicalMailingAddress: "1 Main St, Austin, TX 78701",
  },
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
    db.workspace.findUnique.mockResolvedValue(campaign.workspace);
    db.outboundCampaign.findUnique.mockResolvedValue(campaign);
    db.outboundCampaign.findMany.mockResolvedValue([{ id: campaign.id }]);
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

  it("blocks start when the list has no campaign-ready contacts", async () => {
    db.outboundCampaign.findFirst.mockResolvedValue({
      ...campaign,
      status: "draft",
      list: {
        members: [
          { contactId: "c_bad", contact: { id: "c_bad", email: "not-an-email", firstName: "Pat", lastName: "X", hygieneStatus: "INVALID" } },
          { contactId: "c_rev", contact: { id: "c_rev", email: "bob@gmail.com", firstName: "Bob", lastName: "Y", hygieneStatus: "NEEDS_REVIEW" } },
        ],
      },
    });
    const { startOutreachCampaign } = await import("@/lib/outbound/campaigns");
    await expect(startOutreachCampaign("cmp_1", "w1", db as never)).rejects.toThrow("no campaign-ready contacts");
    expect(db.outboundCampaignJob.upsert).not.toHaveBeenCalled();
  });

  it("does not enroll needs_review, invalid, or duplicate-email primaries", async () => {
    db.outboundCampaign.findFirst.mockResolvedValue({
      ...campaign,
      status: "draft",
      list: {
        members: [
          { contactId: "c1", contact: { id: "c1", email: "one@x.com", firstName: "One", lastName: "A", hygieneStatus: "READY" } },
          { contactId: "c1b", contact: { id: "c1b", email: "one@x.com", firstName: "One", lastName: "Clone", hygieneStatus: "READY" } },
          { contactId: "c_rev", contact: { id: "c_rev", email: "review@x.com", firstName: "Rev", lastName: "B", hygieneStatus: "NEEDS_REVIEW" } },
          { contactId: "c_bad", contact: { id: "c_bad", email: "bad", firstName: "Bad", lastName: "C", hygieneStatus: "INVALID" } },
        ],
      },
    });
    db.outboundCampaignJob.upsert.mockResolvedValue({});
    const { startOutreachCampaign } = await import("@/lib/outbound/campaigns");
    await startOutreachCampaign("cmp_1", "w1", db as never);
    const creates = db.outboundCampaignJob.upsert.mock.calls.map((call: unknown[]) => (call[0] as { create: { email: string; status: string; skipReason: string | null } }).create);
    expect(creates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: "one@x.com", status: "queued", skipReason: null }),
        expect.objectContaining({ email: "one@x.com", status: "skipped", skipReason: "DUPLICATE_EMAIL" }),
        expect.objectContaining({ email: "review@x.com", status: "skipped", skipReason: "NEEDS_REVIEW" }),
        expect.objectContaining({ email: "bad", status: "skipped", skipReason: "INVALID" }),
      ]),
    );
  });

  it("skips needs_review contacts at send time", async () => {
    db.outboundCampaignJob.findMany.mockResolvedValue([
      { id: "j1", campaignId: "cmp_1", contactId: "c1", email: "one@x.com", status: "queued" },
    ]);
    db.contact.findUnique.mockResolvedValue({ id: "c1", email: "one@x.com", firstName: "One", hygieneStatus: "NEEDS_REVIEW" });
    const { processCampaignBatch } = await import("@/lib/outbound/campaigns");
    const result = await processCampaignBatch("cmp_1", { db: db as never, provider: new StubOutboundProvider() });
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(db.outboundCampaignJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "skipped", skipReason: "NEEDS_REVIEW" }) }),
    );
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

  it("blocks start without a physical mailing address", async () => {
    db.outboundCampaign.findFirst.mockResolvedValue({ ...campaign, status: "draft" });
    db.workspace.findUnique.mockResolvedValue({ id: "w1", name: "Acme", physicalMailingAddress: null });
    const { startOutreachCampaign } = await import("@/lib/outbound/campaigns");
    await expect(startOutreachCampaign("cmp_1", "w1", db as never)).rejects.toThrow("physical mailing address");
    expect(db.outboundCampaignJob.upsert).not.toHaveBeenCalled();
  });

  it("blocks start without an unsubscribe merge tag", async () => {
    db.outboundCampaign.findFirst.mockResolvedValue({
      ...campaign,
      status: "draft",
      body: "Hello {{FirstName}} with no unsub tag",
    });
    const { startOutreachCampaign } = await import("@/lib/outbound/campaigns");
    await expect(startOutreachCampaign("cmp_1", "w1", db as never)).rejects.toThrow("unsubscribe_url");
    expect(db.outboundCampaignJob.upsert).not.toHaveBeenCalled();
  });

  it("appends mailing address and unsubscribe URL on Instantly sends", async () => {
    const send = vi.fn(async () => ({ ok: true, provider: "stub" }));
    db.outboundCampaignJob.findMany.mockResolvedValue([
      { id: "j1", campaignId: "cmp_1", contactId: "c1", email: "one@x.com", status: "queued", unsubscribeToken: "tok_unsub" },
    ]);
    const { processCampaignBatch } = await import("@/lib/outbound/campaigns");
    await processCampaignBatch("cmp_1", { db: db as never, provider: { id: "stub", send } as never });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("1 Main St, Austin, TX 78701"),
      }),
    );
    expect(send.mock.calls[0][0].body).toContain("/unsubscribe/tok_unsub");
    expect(send.mock.calls[0][0].body).toContain("Acme Inc");
  });

  it("worker drains running Instantly campaigns without a manual process click", async () => {
    db.outboundCampaignJob.findMany.mockResolvedValue([
      { id: "j1", campaignId: "cmp_1", contactId: "c1", email: "one@x.com", status: "queued", unsubscribeToken: "t1" },
    ]);
    const { processRunningOutboundCampaigns } = await import("@/lib/outbound/campaigns");
    const result = await processRunningOutboundCampaigns({ db: db as never, provider: new StubOutboundProvider() });
    expect(db.outboundCampaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "running" } }),
    );
    expect(result.sent).toBe(1);
    expect(result.processedCampaigns).toBe(1);
    expect(source("lib/jobs/service.ts")).toContain("processRunningOutboundCampaigns");
    expect(source("lib/jobs/service.ts")).toContain("OUTBOUND_CAMPAIGN_BATCH");
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
