import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const access = vi.fn(async (workspaceId?: string) => ({ user: { id: "user_1" }, workspace: { id: workspaceId ?? "workspace_1", name: "Workspace" }, membership: { id: "member_1" } }));
const notFound = vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); });
const audit = vi.fn(async () => ({}));

const prisma = {
  outreachCampaign: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  leadOutreachStatus: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  lead: { count: vi.fn() },
  contact: { count: vi.fn() },
  company: { count: vi.fn() },
  opportunity: { count: vi.fn() },
  callSession: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  diagnosticSession: { create: vi.fn() }
};

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/auth/rbac", () => ({ requireWorkspaceAccess: access }));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/audit/service", () => ({ audit }));

describe("outreach campaign workflow repair", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.outreachCampaign.count.mockResolvedValue(1);
    prisma.lead.count.mockResolvedValue(1);
    prisma.leadOutreachStatus.findFirst.mockResolvedValue(null);
  });

  it("campaign list cards link to campaign detail pages", () => {
    const source = readFileSync("components/dashboard/outreach-pages.tsx", "utf8");
    expect(source).toContain('href={`/dashboard/outreach/${campaign.id}`}');
    expect(source).toContain("Open a campaign to assign leads and manually update outreach status.");
  });

  it("campaign detail loader is workspace-scoped", async () => {
    const { getOutreachCampaignDetail } = await import("@/lib/workflows/service");
    prisma.outreachCampaign.findFirst.mockResolvedValue({ id: "campaign_1", workspaceId: "workspace_1", leadStatuses: [], steps: [] });
    await getOutreachCampaignDetail("workspace_1", "campaign_1");
    expect(access).toHaveBeenCalledWith("workspace_1");
    expect(prisma.outreachCampaign.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "campaign_1", workspaceId: "workspace_1" } }));
  });

  it("cross-workspace campaign access is denied without leaking existence", async () => {
    const { getOutreachCampaignDetail } = await import("@/lib/workflows/service");
    prisma.outreachCampaign.findFirst.mockResolvedValue(null);
    await expect(getOutreachCampaignDetail("workspace_1", "campaign_from_other_workspace")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(prisma.outreachCampaign.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "campaign_from_other_workspace", workspaceId: "workspace_1" } }));
  });

  it("manual outreach status update is workspace-scoped", async () => {
    const { updateLeadOutreachStatus } = await import("@/lib/workflows/service");
    prisma.leadOutreachStatus.create.mockResolvedValue({ id: "status_1", workspaceId: "workspace_1", leadId: "lead_1", campaignId: "campaign_1", status: "QUEUED" });
    await updateLeadOutreachStatus("workspace_1", "lead_1", { campaignId: "campaign_1", status: "QUEUED", notes: "Ready for manual send" });
    expect(prisma.lead.count).toHaveBeenCalledWith({ where: { id: "lead_1", workspaceId: "workspace_1" } });
    expect(prisma.outreachCampaign.count).toHaveBeenCalledWith({ where: { id: "campaign_1", workspaceId: "workspace_1" } });
    expect(prisma.leadOutreachStatus.findFirst).toHaveBeenCalledWith({ where: { workspaceId: "workspace_1", leadId: "lead_1", campaignId: "campaign_1" } });
    expect(prisma.leadOutreachStatus.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ workspaceId: "workspace_1", leadId: "lead_1", campaignId: "campaign_1", status: "QUEUED", updatedById: "user_1" }) }));
  });

  it("campaign empty states render for unassigned leads and campaign steps", () => {
    const source = readFileSync("components/dashboard/outreach-pages.tsx", "utf8");
    expect(source).toContain("No leads assigned to this campaign yet.");
    expect(source).toContain("Assign a lead to begin tracking outreach.");
    expect(source).toContain("No campaign steps configured yet.");
  });
});
