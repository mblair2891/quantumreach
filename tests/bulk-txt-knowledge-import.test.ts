import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildTxtImportPreview, extractTxtImportDescription, extractTxtImportTitle, suggestTxtImportMetadata, validateTxtImportFile } from "@/lib/knowledge/import";

const source = (path: string) => readFileSync(path, "utf8");

describe("bulk TXT knowledge import", () => {
  it("extracts titles from the first heading-like line and falls back to readable filenames", () => {
    expect(extractTxtImportTitle("fallback_name.txt", "\n# Master System Operating Doctrine\n\nBody text here")).toBe("Master System Operating Doctrine");
    expect(extractTxtImportTitle("Business_Strategy-Exit_Architecture.txt", "plain body without heading")).toBe("Business Strategy Exit Architecture");
  });

  it("extracts clean descriptions from meaningful source paragraphs", () => {
    const description = extractTxtImportDescription("# Heading\n\n**Global** governing operating doctrine for AI decisions. It removes ambiguity and sets executive constraints for generation.");
    expect(description).toContain("Global governing operating doctrine");
    expect(description).not.toContain("**");
    expect(extractTxtImportDescription("   \n---\n   ")).toBe("Imported source-of-truth document.");
  });

  it("rejects unsupported files and oversized TXT files before preview", () => {
    expect(validateTxtImportFile({ name: "source.pdf", size: 10, type: "application/pdf" })).toContain(".txt files only");
    expect(validateTxtImportFile({ name: "source.txt", size: 600 * 1024, type: "text/plain" })).toContain("too large");
    expect(validateTxtImportFile({ name: "source.txt", size: 100, type: "text/plain" })).toBeNull();
  });

  it("suggests deterministic metadata from filenames and text without AI", () => {
    expect(suggestTxtImportMetadata("Master_System_Operating_Doctrine.txt", "Master System Operating Doctrine")).toMatchObject({ documentType: "SYSTEM_DOCTRINE", authorityLevel: "SYSTEM_DOCTRINE", priority: "GLOBAL" });
    expect(suggestTxtImportMetadata("Finesse_IT_Layer.txt", "Finesse IT Layer Master Prompt")).toMatchObject({ documentType: "REPORT_FRAMEWORK", authorityLevel: "STRATEGY_FRAMEWORK", priority: "HIGH" });
    expect(suggestTxtImportMetadata("Authority_Dominance_Blueprint.txt", "Authority Dominance Blueprint")).toMatchObject({ documentType: "AUTHORITY_TEMPLATE", authorityLevel: "AUTHORITY_TEMPLATE" });
  });

  it("defaults previews to DRAFT and only marks ACTIVE when explicitly edited", () => {
    const preview = buildTxtImportPreview({ name: "Rollout_Directive.txt", size: 120, type: "text/plain", text: "Rollout Directive\n\nThis is a source-of-truth paragraph long enough for import." });
    expect(preview.status).toBe("DRAFT");
    expect(preview.documentType).toBe("PRODUCT_DOCTRINE");
  });

  it("bulk document creation remains workspace-scoped and generates chunks", () => {
    const service = source("lib/knowledge/service.ts");
    expect(service).toContain("bulkCreateKnowledgeDocuments(workspaceId");
    expect(service).toContain("await requireWorkspaceAccess(workspaceId)");
    expect(service).toContain("workspaceId, title: item.title");
    expect(service).toContain("await regenerateKnowledgeChunks(workspaceId, document.id, user.id)");
  });

  it("links the import workflow from the knowledge dashboard", () => {
    const page = source("app/dashboard/knowledge/page.tsx");
    expect(page).toContain('/dashboard/knowledge/import');
    expect(page).toContain("Bulk import TXT");
  });
});
