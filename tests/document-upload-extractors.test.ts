import { describe, expect, it } from "vitest";
import { deflateRawSync, deflateSync } from "node:zlib";
import { readFileSync } from "node:fs";
import {
  buildKnowledgeFilePreview,
  extractKnowledgeFile,
} from "@/lib/knowledge/extractors";
import {
  buildKnowledgeImportPreview,
  validateKnowledgeUploadFile,
} from "@/lib/knowledge/import";

function makeFile(name: string, type: string, body: Buffer | string) {
  const part = typeof body === "string" ? body : new Uint8Array(body);
  return new File([part], name, { type });
}

function minimalPdf(contentStream: Buffer | string, filter = "") {
  const stream =
    typeof contentStream === "string"
      ? Buffer.from(contentStream, "latin1")
      : contentStream;
  const streamObject = `4 0 obj\n<< /Length ${stream.length}${filter ? ` /Filter /${filter}` : ""} >>\nstream\n${stream.toString("latin1")}\nendstream\nendobj`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj",
    streamObject,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${object}\n`;
  }
  const xrefOffset = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, "latin1");
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
    await expect(
      extractKnowledgeFile(
        makeFile(
          "doctrine.txt",
          "text/plain",
          "Operating Doctrine\n\nUseful body",
        ),
      ),
    ).resolves.toMatchObject({
      detectedFileType: "TXT",
      sourceText: expect.stringContaining("Operating Doctrine"),
    });
    await expect(
      extractKnowledgeFile(
        makeFile(
          "guide.md",
          "text/markdown",
          "# Rollout Directive\n\nUseful body",
        ),
      ),
    ).resolves.toMatchObject({
      detectedFileType: "MD",
      sourceText: expect.stringContaining("Rollout Directive"),
    });
  });

  it("extracts DOCX document.xml text", async () => {
    const docx = zipSingleFile(
      "word/document.xml",
      "<w:document><w:body><w:p><w:r><w:t>Execution Handoff</w:t></w:r></w:p></w:body></w:document>",
    );
    await expect(
      extractKnowledgeFile(
        makeFile(
          "handoff.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          docx,
        ),
      ),
    ).resolves.toMatchObject({
      detectedFileType: "DOCX",
      sourceText: "Execution Handoff",
    });
  });

  it("extracts selectable PDF text from compressed content streams", async () => {
    const content =
      "BT /F1 12 Tf 72 720 Td <536f757263652d6f662d747275746820504446> Tj T* [(Extracted) -80 ( reliably)] TJ ET";
    const pdf = minimalPdf(
      deflateSync(Buffer.from(content, "latin1")),
      "FlateDecode",
    );

    await expect(
      extractKnowledgeFile(makeFile("report.pdf", "application/pdf", pdf)),
    ).resolves.toMatchObject({
      detectedFileType: "PDF",
      sourceText: expect.stringContaining(
        "Source-of-truth PDF\nExtracted reliably",
      ),
    });
  });

  it("rejects encoded or garbled selectable PDF text as unreadable", async () => {
    const content = "BT /F1 12 Tf 72 720 Td (0DUNGRZQ 7HVW 'RFWULQH) Tj ET";

    await expect(
      extractKnowledgeFile(
        makeFile(
          "markdown-test-doctrine.pdf",
          "application/pdf",
          minimalPdf(content),
        ),
      ),
    ).resolves.toMatchObject({
      detectedFileType: "PDF",
      sourceText: "",
      warnings: expect.arrayContaining([
        "Text was detected, but it could not be decoded into readable content. Try converting this PDF to TXT or DOCX before importing.",
        "No useful text was extracted. Review the file or convert it to text before importing.",
      ]),
    });
  });

  it("does not derive import metadata from garbled PDF text", async () => {
    const content = "BT /F1 12 Tf 72 720 Td (0DUNGRZQ 7HVW 'RFWULQH) Tj ET";

    const preview = await buildKnowledgeFilePreview(
      makeFile("encoded-source.pdf", "application/pdf", minimalPdf(content)),
    );

    expect(preview).toMatchObject({
      detectedFileType: "PDF",
      extractionStatus: "WARNING",
      sourceText: "",
      title: "encoded source",
      description: "Imported source-of-truth document.",
      status: "DRAFT",
    });
    expect(preview.title).not.toContain("DUNGRZQ");
    expect(preview.description).not.toContain("RFWULQH");
  });

  it("rejects excessive single-character vertical PDF text", async () => {
    const content =
      "BT /F1 12 Tf 72 720 Td (A) Tj T* (B) Tj T* (C) Tj T* (D) Tj T* (E) Tj T* (F) Tj T* (G) Tj T* (H) Tj T* (I) Tj T* (J) Tj T* (K) Tj T* (L) Tj ET";

    await expect(
      extractKnowledgeFile(
        makeFile("vertical.pdf", "application/pdf", minimalPdf(content)),
      ),
    ).resolves.toMatchObject({
      detectedFileType: "PDF",
      sourceText: "",
      warnings: expect.arrayContaining([
        "Text was detected, but it could not be decoded into readable content. Try converting this PDF to TXT or DOCX before importing.",
      ]),
    });
  });

  it("keeps scanned or empty PDFs on the OCR-not-supported warning path", async () => {
    await expect(
      extractKnowledgeFile(
        makeFile(
          "scan.pdf",
          "application/pdf",
          minimalPdf("q 100 0 0 100 0 0 cm /Im1 Do Q"),
        ),
      ),
    ).resolves.toMatchObject({
      detectedFileType: "PDF",
      sourceText: "",
      warnings: expect.arrayContaining([
        "No selectable text was found. This may be a scanned document. OCR is not yet supported.",
        "No useful text was extracted. Review the file or convert it to text before importing.",
      ]),
    });
  });

  it("validates unsupported types and upload size limits", () => {
    expect(
      validateKnowledgeUploadFile({
        name: "notes.rtf",
        size: 100,
        type: "application/rtf",
      }),
    ).toContain("not supported");
    expect(
      validateKnowledgeUploadFile({
        name: "large.pdf",
        size: 6 * 1024 * 1024,
        type: "application/pdf",
      }),
    ).toContain("too large");
  });

  it("keeps uploaded previews draft unless ACTIVE is explicitly selected", () => {
    const preview = buildKnowledgeImportPreview({
      name: "Business_Strategy.md",
      type: "text/markdown",
      size: 100,
      text: "# Business Strategy\n\nMeaningful source paragraph long enough to become a description.",
    });
    expect(preview.status).toBe("DRAFT");
    expect({ ...preview, status: "ACTIVE" }).toMatchObject({
      status: "ACTIVE",
    });
  });
});

describe("knowledge operations UI and versioning safeguards", () => {
  it("documents deferred original file storage and coverage dashboard warnings", () => {
    const detail = readFileSync(
      "app/dashboard/knowledge/[id]/page.tsx",
      "utf8",
    );
    const dashboard = readFileSync("app/dashboard/knowledge/page.tsx", "utf8");
    expect(detail).toContain(
      "Deferred; extracted text and source metadata stored.",
    );
    expect(dashboard).toContain("Knowledge coverage");
    expect(dashboard).toContain("coverage.warnings");
  });

  it("keeps source usage history exact and denies cross-workspace version links", () => {
    const service = readFileSync("lib/knowledge/service.ts", "utf8");
    expect(service).toContain("summarizeSources(chunks");
    expect(service).toContain("version: chunk.document.version");
    expect(service).toContain("id: supersedesDocumentId, workspaceId");
    expect(service).toContain(
      "Superseded document must be in the active workspace",
    );
  });
});
