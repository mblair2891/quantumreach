import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildKnowledgeOriginalStorageKey, isWorkspaceKnowledgeStorageKey, sanitizeStorageFileName } from "@/lib/storage/r2";

const source = (path: string) => readFileSync(path, "utf8");

describe("phase 8 original file storage and knowledge operations", () => {
  it("generates workspace and document scoped storage keys with sanitized filenames", () => {
    const key = buildKnowledgeOriginalStorageKey("workspace_1", "doc_1", "../Board Deck Final.pdf");
    expect(key).toContain("workspaces/workspace_1/knowledge-documents/doc_1/original/");
    expect(key).toContain("Board-Deck-Final.pdf");
    expect(key).not.toContain("..");
    expect(sanitizeStorageFileName("bad / name.md")).toBe("bad-name.md");
    expect(isWorkspaceKnowledgeStorageKey(key, "workspace_1", "doc_1")).toBe(true);
    expect(isWorkspaceKnowledgeStorageKey(key, "workspace_2", "doc_1")).toBe(false);
  });

  it("final import resubmits original files, stores them in R2, and links storageKey on the document", () => {
    const form = source("components/dashboard/knowledge-import-form.tsx");
    const page = source("app/dashboard/knowledge/import/page.tsx");
    const service = source("lib/knowledge/service.ts");
    expect(form).toContain('formData.append("originalFiles"');
    expect(form).toContain('formData.append("originalFileClientIds"');
    expect(page).toContain('formData.getAll("originalFiles")');
    expect(service).toContain("putKnowledgeOriginalFile({ workspaceId, documentId");
    expect(service).toContain("storageKey = stored.key");
    expect(service).toContain('action: "knowledge.original_file_stored"');
  });

  it("download route authorizes by workspace document ownership and never trusts client storage keys", () => {
    const route = source("app/api/knowledge/[id]/download-original/route.ts");
    expect(route).toContain("getCurrentWorkspace()");
    expect(route).toContain("where: { id: params.id, workspaceId: workspace.id }");
    expect(route).toContain("isWorkspaceKnowledgeStorageKey(document.storageKey, workspace.id, document.id)");
    expect(route).not.toContain("searchParams.get(\"storageKey\")");
    expect(route).toContain('knowledge.original_file_downloaded');
  });

  it("hard delete removes unused original files before deleting database records and preserves used or active documents", () => {
    const service = source("lib/knowledge/service.ts");
    expect(service).toContain('if (document.status === "ACTIVE")');
    expect(service).toContain("usageCount > 0 || sourceReferenceCount > 0");
    expect(service).toContain("await deleteKnowledgeOriginalFile(document.storageKey)");
    expect(service.indexOf("await deleteKnowledgeOriginalFile(document.storageKey)")).toBeLessThan(service.indexOf("prisma.knowledgeDocument.delete"));
    expect(service).toContain('knowledge.original_file_deleted');
  });

  it("new versions are created as draft records without overwriting the superseded document", () => {
    const service = source("lib/knowledge/service.ts");
    const detail = source("app/dashboard/knowledge/[id]/page.tsx");
    expect(service).toContain('const status = supersedesDocumentId ? "DRAFT" : item.status');
    expect(service).toContain("parentDocumentId: supersedesDocumentId, supersedesDocumentId");
    expect(service).toContain('action: supersedesDocumentId ? "knowledge.document_version_created"');
    expect(detail).toContain("Version history");
    expect(detail).toContain("New version from upload");
  });

  it("UI shows source file storage state and avoids raw storage keys or raw JSON", () => {
    const detail = source("app/dashboard/knowledge/[id]/page.tsx");
    expect(detail).toContain("Source file");
    expect(detail).toContain("Original file stored");
    expect(detail).toContain("Download original file");
    expect(detail).toContain("Original file storage was not available");
    expect(detail).not.toContain("{document.storageKey}");
    expect(detail).not.toContain("JSON.stringify");
  });

  it("environment placeholders remain placeholder-only", () => {
    const env = source(".env.example");
    expect(env).toContain('R2_ACCOUNT_ID="paste_actual_value_here_locally_do_not_send_to_chat"');
    expect(env).toContain('R2_ACCESS_KEY_ID="paste_actual_value_here_locally_do_not_send_to_chat"');
    expect(env).toContain('R2_SECRET_ACCESS_KEY="paste_actual_value_here_locally_do_not_send_to_chat"');
    expect(env).toContain('R2_BUCKET_NAME="quantum-reach-assets"');
    expect(env).not.toContain("AKIA");
  });
});
