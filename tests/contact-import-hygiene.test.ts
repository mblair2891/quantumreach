import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

const prisma = {
  contact: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  company: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  workspace: { findUnique: vi.fn() },
  suppressionListEntry: { findMany: vi.fn() },
  contactImportBatch: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  contactImportRow: { update: vi.fn() },
  outboundList: { create: vi.fn() },
  outboundListMember: { create: vi.fn() },
};

vi.mock("@/lib/db/prisma", () => ({ prisma }));

describe("contact import hygiene pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.workspace.findUnique.mockResolvedValue({ settings: {} });
    prisma.contact.findMany.mockResolvedValue([]);
    prisma.suppressionListEntry.findMany.mockResolvedValue([]);
    prisma.company.findFirst.mockResolvedValue(null);
    prisma.company.create.mockImplementation(async ({ data }) => ({ id: "co1", ...data }));
    prisma.contact.create.mockImplementation(async ({ data }) => ({ id: "c_new", ...data }));
    prisma.contact.update.mockImplementation(async ({ data, where }) => ({ id: where.id, ...data }));
    prisma.contactImportRow.update.mockResolvedValue({});
    prisma.contactImportBatch.create.mockImplementation(async ({ data }) => ({ id: "batch_1", ...data, rows: data.rows.create }));
    prisma.contactImportBatch.update.mockImplementation(async ({ data }) => ({ id: "batch_1", ...data }));
  });

  it("preview counts ready vs needs_review vs invalid and stores flags", async () => {
    const { createImportPreview } = await import("@/lib/revenue-os/imports");
    const batch = await createImportPreview("w1", [
      { email: "ada@acme.com", firstName: "Ada", lastName: "Lovelace", company: "Acme", companyDomain: "acme.com" },
      { email: "bob@gmail.com", firstName: "Bob", lastName: "Jones", company: "Acme", companyDomain: "acme.com" },
      { email: "bad", firstName: "Pat", lastName: "Prospect" },
      { email: "ada@acme.com", firstName: "Ada", lastName: "Clone" },
    ]);
    expect(batch.readyCount).toBe(1);
    expect(batch.needsReviewCount).toBe(1);
    expect(batch.mergedCount).toBe(1);
    const issues = (row: { issues: unknown }) => (Array.isArray(row.issues) ? row.issues.map(String) : []);
    expect(batch.rows.some((row) => issues(row).includes("domain_mismatch"))).toBe(true);
    expect(batch.rows.some((row) => issues(row).includes("invalid_email"))).toBe(true);
    expect(batch.rows.some((row) => issues(row).includes("duplicate_in_upload"))).toBe(true);
  });

  it("import ready only persists the primary ready contact once", async () => {
    const { commitImportBatch } = await import("@/lib/revenue-os/imports");
    prisma.contactImportBatch.findFirst.mockResolvedValue({
      id: "batch",
      workspaceId: "w1",
      status: "PREVIEW",
      fileName: "leads.csv",
      listName: "April",
      createdById: "u1",
      rows: [
        {
          id: "r1",
          rowNumber: 1,
          mapped: { email: "ada@acme.com", firstName: "Ada", lastName: "Lovelace", company: "Acme", companyDomain: "acme.com" },
          issues: [],
          hygieneStatus: "READY",
          isValid: true,
        },
        {
          id: "r2",
          rowNumber: 2,
          mapped: { email: "bob@gmail.com", firstName: "Bob", lastName: "Jones", company: "Acme", companyDomain: "acme.com" },
          issues: ["domain_mismatch"],
          hygieneStatus: "NEEDS_REVIEW",
          isValid: false,
        },
        {
          id: "r3",
          rowNumber: 3,
          mapped: { email: "ada@acme.com", firstName: "Ada", lastName: "Clone" },
          issues: ["duplicate_in_upload"],
          hygieneStatus: "READY",
          isValid: false,
        },
      ],
    });
    prisma.outboundList.create.mockResolvedValue({ id: "list_1" });
    prisma.outboundListMember.create.mockResolvedValue({});
    await expect(commitImportBatch("w1", "batch", false)).rejects.toThrow("Compliance attestation");
    const result = await commitImportBatch("w1", "batch", true, { readyOnly: true });
    expect(prisma.contact.create).toHaveBeenCalledTimes(1);
    expect(prisma.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "ada@acme.com", hygieneStatus: "READY" }),
      }),
    );
    expect(result.committedCount).toBe(1);
    expect(prisma.outboundListMember.create).toHaveBeenCalledTimes(1);
  });

  it("import UI previews counts, imports ready only, and exports rejects", () => {
    const page = source("app/dashboard/imports/page.tsx");
    const batch = source("app/dashboard/imports/[batchId]/page.tsx");
    const rejects = source("app/dashboard/imports/[batchId]/rejects/route.ts");
    expect(page).toContain("Preview hygiene");
    expect(batch).toContain("Import ready only");
    expect(batch).toContain("Sample flagged rows");
    expect(batch).toContain("Export rejects");
    expect(rejects).toContain("rejectsCsv");
    expect(source("lib/outbound/campaigns.ts")).toContain("no campaign-ready contacts");
    expect(source("lib/outbound/campaigns.ts")).toContain("isCampaignEligible");
  });
});
