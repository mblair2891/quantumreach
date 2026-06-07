import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const notFound = vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); });
const access = vi.fn();
const prisma = {
  knowledgeDocument: { findFirst: vi.fn(), delete: vi.fn() },
  knowledgeDocumentUsage: { count: vi.fn() },
  knowledgeSourceReference: { count: vi.fn() },
  knowledgeChunk: { deleteMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn()
};

vi.mock("next/navigation", () => ({ notFound, redirect: vi.fn() }));
vi.mock("@/lib/auth/rbac", () => ({ requireWorkspaceAccess: access }));
vi.mock("@/lib/db/prisma", () => ({ prisma }));
vi.mock("@/lib/audit/service", () => ({ audit: vi.fn() }));

const draftDocument = (status: "DRAFT" | "ARCHIVED" | "ACTIVE" = "DRAFT") => ({
  id: "doc_1",
  workspaceId: "workspace_1",
  title: "Governed Doctrine",
  status,
  authorityLevel: "SYSTEM_DOCTRINE",
  documentType: "SYSTEM_DOCTRINE",
  version: "1.0",
  chunks: [{ id: "chunk_1" }, { id: "chunk_2" }]
});

async function loadService() {
  vi.resetModules();
  return import("@/lib/knowledge/service");
}

beforeEach(() => {
  vi.clearAllMocks();
  access.mockResolvedValue({ user: { id: "user_1" } });
  prisma.knowledgeDocument.findFirst.mockResolvedValue(draftDocument());
  prisma.knowledgeDocumentUsage.count.mockResolvedValue(0);
  prisma.knowledgeSourceReference.count.mockResolvedValue(0);
  prisma.auditLog.create.mockReturnValue(Promise.resolve({ id: "audit_1" }));
  prisma.knowledgeChunk.deleteMany.mockReturnValue(Promise.resolve({ count: 2 }));
  prisma.knowledgeDocument.delete.mockReturnValue(Promise.resolve({ id: "doc_1" }));
  prisma.$transaction.mockResolvedValue([]);
});

describe("knowledge document permanent delete", () => {
  it("deletes DRAFT documents with no recorded usage, audits the deletion, and removes chunks", async () => {
    const { deleteKnowledgeDocument } = await loadService();

    await expect(deleteKnowledgeDocument("workspace_1", "doc_1")).resolves.toEqual({ id: "doc_1", title: "Governed Doctrine", deletedChunks: 2 });

    expect(access).toHaveBeenCalledWith("workspace_1");
    expect(prisma.knowledgeDocument.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "doc_1", workspaceId: "workspace_1" } }));
    expect(prisma.knowledgeDocumentUsage.count).toHaveBeenCalledWith({ where: { workspaceId: "workspace_1", documentId: "doc_1" } });
    expect(prisma.knowledgeSourceReference.count).toHaveBeenCalledWith({ where: { workspaceId: "workspace_1", documentId: "doc_1" } });
    expect(prisma.knowledgeChunk.deleteMany).toHaveBeenCalledWith({ where: { workspaceId: "workspace_1", documentId: "doc_1" } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "knowledge.document_deleted", workspaceId: "workspace_1", entityId: "doc_1", actorId: "user_1" }) }));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("deletes ARCHIVED documents with no recorded usage", async () => {
    prisma.knowledgeDocument.findFirst.mockResolvedValue(draftDocument("ARCHIVED"));
    const { deleteKnowledgeDocument } = await loadService();

    await expect(deleteKnowledgeDocument("workspace_1", "doc_1")).resolves.toMatchObject({ id: "doc_1", deletedChunks: 2 });

    expect(prisma.knowledgeDocument.delete).toHaveBeenCalledWith({ where: { id: "doc_1" } });
  });

  it("blocks ACTIVE documents with the safe archive-first message", async () => {
    prisma.knowledgeDocument.findFirst.mockResolvedValue(draftDocument("ACTIVE"));
    const { activeKnowledgeDeleteMessage, deleteKnowledgeDocument } = await loadService();

    await expect(deleteKnowledgeDocument("workspace_1", "doc_1")).rejects.toThrow(activeKnowledgeDeleteMessage);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("blocks documents with KnowledgeDocumentUsage records", async () => {
    prisma.knowledgeDocumentUsage.count.mockResolvedValue(1);
    const { deleteKnowledgeDocument, usedKnowledgeDeleteMessage } = await loadService();

    await expect(deleteKnowledgeDocument("workspace_1", "doc_1")).rejects.toThrow(usedKnowledgeDeleteMessage);

    expect(prisma.knowledgeChunk.deleteMany).not.toHaveBeenCalled();
  });

  it("blocks documents with KnowledgeSourceReference records", async () => {
    prisma.knowledgeSourceReference.count.mockResolvedValue(1);
    const { deleteKnowledgeDocument, usedKnowledgeDeleteMessage } = await loadService();

    await expect(deleteKnowledgeDocument("workspace_1", "doc_1")).rejects.toThrow(usedKnowledgeDeleteMessage);

    expect(prisma.knowledgeDocument.delete).not.toHaveBeenCalled();
  });

  it("requires workspace access before lookup and never deletes across workspaces", async () => {
    access.mockRejectedValue(new Error("forbidden"));
    const { deleteKnowledgeDocument } = await loadService();

    await expect(deleteKnowledgeDocument("workspace_2", "doc_1")).rejects.toThrow("forbidden");

    expect(prisma.knowledgeDocument.findFirst).not.toHaveBeenCalled();
    expect(prisma.knowledgeDocument.delete).not.toHaveBeenCalled();
  });

  it("keeps workspaceId in lookup, usage checks, and chunk removal", () => {
    const source = readFileSync("lib/knowledge/service.ts", "utf8");
    expect(source).toContain("findFirst({ where: { id: documentId, workspaceId }");
    expect(source).toContain("knowledgeDocumentUsage.count({ where: { workspaceId, documentId } })");
    expect(source).toContain("knowledgeSourceReference.count({ where: { workspaceId, documentId } })");
    expect(source).toContain("knowledgeChunk.deleteMany({ where: { workspaceId, documentId } })");
  });

  it("renders confirmation language and redirects to the knowledge dashboard after delete", () => {
    const deleteAction = readFileSync("components/dashboard/knowledge-delete-action.tsx", "utf8");
    const detailPage = readFileSync("app/dashboard/knowledge/[id]/page.tsx", "utf8");
    expect(deleteAction).toContain("Delete permanently");
    expect(deleteAction).toContain("Permanent deletion cannot be undone");
    expect(deleteAction).toContain("window.confirm");
    expect(detailPage).toContain('redirect("/dashboard/knowledge?deleted=1")');
  });
});
