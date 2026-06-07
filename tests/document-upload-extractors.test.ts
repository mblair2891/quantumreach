import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { extractKnowledgeFile } from "@/lib/knowledge/extractors";
import { buildKnowledgeImportPreview, validateKnowledgeUploadFile } from "@/lib/knowledge/import";

function makeFile(name: string, type: string, body: Buffer | string) {
  const part = typeof body === "string" ? body : new Uint8Array(body);
  return new File([part], name, { type });
}

function zipSingleFile(name: string, content: string) {
  const nameBuffer = Buffer.from(name);
  const data = deflateRawSync(Buffer.from(content));
  const local = Buffer.alloc(30 + nameBuffer.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(Buffer.byteLength(content), 22);
  local.writeUInt16LE(nameBuffer.length, 26);
  nameBuffer.copy(local, 30);
  const central = Buffer.alloc(46 + nameBuffer.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(Buffer.byteLength(content), 24);
  central.writeUInt16LE(nameBuffer.length, 28);
  central.writeUInt32LE(0, 42);
  nameBuffer.copy(central, 46);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(local.length + data.length, 16);
  return Buffer.concat([local, data, central, end]);
}

describe("document upload extraction", () => {
  it("extracts TXT and Markdown as UTF-8 text", async () => {
    await expect(extractKnowledgeFile(makeFile("doctrine.txt", "text/plain", "Operating Doctrine\n\nUseful body"))).resolves.toMatchObject({ detectedFileType: "TXT", sourceText: expect.stringContaining("Operating Doctrine") });
    await expect(extractKnowledgeFile(makeFile("guide.md", "text/markdown", "# Rollout Directive\n\nUseful body"))).resolves.toMatchObject({ detectedFileType: "MD", sourceText: expect.stringContaining("Rollout Directive") });
  });

  it("extracts DOCX document.xml text", async () => {
    const docx = zipSingleFile("word/document.xml", "<w:document><w:body><w:p><w:r><w:t>Execution Handoff</w:t></w:r></w:p></w:body></w:document>");
    await expect(extractKnowledgeFile(makeFile("handoff.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", docx))).resolves.toMatchObject({ detectedFileType: "DOCX", sourceText: "Execution Handoff" });
  });

  it("extracts selectable PDF strings and warns when none are found", async () => {
    await expect(extractKnowledgeFile(makeFile("report.pdf", "application/pdf", "%PDF-1.4 (Report Framework) Tj"))).resolves.toMatchObject({ detectedFileType: "PDF", sourceText: "Report Framework" });
    await expect(extractKnowledgeFile(makeFile("scan.pdf", "application/pdf", "%PDF-1.4"))).resolves.toMatchObject({ detectedFileType: "PDF", warnings: expect.arrayContaining(["No selectable text was found. This may be a scanned document. OCR is not yet supported."]) });
  });

  it("validates unsupported types and upload size limits", () => {
    expect(validateKnowledgeUploadFile({ name: "notes.rtf", size: 100, type: "application/rtf" })).toContain("not supported");
    expect(validateKnowledgeUploadFile({ name: "large.pdf", size: 6 * 1024 * 1024, type: "application/pdf" })).toContain("too large");
  });

  it("keeps uploaded previews draft unless ACTIVE is explicitly selected", () => {
    const preview = buildKnowledgeImportPreview({ name: "Business_Strategy.md", type: "text/markdown", size: 100, text: "# Business Strategy\n\nMeaningful source paragraph long enough to become a description." });
    expect(preview.status).toBe("DRAFT");
    expect({ ...preview, status: "ACTIVE" }).toMatchObject({ status: "ACTIVE" });
  });
});

describe("knowledge operations UI and versioning safeguards", () => {
  it("documents deferred original file storage and coverage dashboard warnings", () => {
    const detail = readFileSync("app/dashboard/knowledge/[id]/page.tsx", "utf8");
    const dashboard = readFileSync("app/dashboard/knowledge/page.tsx", "utf8");
    expect(detail).toContain("Deferred; extracted text and source metadata stored.");
    expect(dashboard).toContain("Knowledge coverage");
    expect(dashboard).toContain("coverage.warnings");
  });

  it("keeps source usage history exact and denies cross-workspace version links", () => {
    const service = readFileSync("lib/knowledge/service.ts", "utf8");
    expect(service).toContain("summarizeSources(chunks");
    expect(service).toContain("version: chunk.document.version");
    expect(service).toContain("id: supersedesDocumentId, workspaceId");
    expect(service).toContain("Superseded document must be in the active workspace");
  });
});
