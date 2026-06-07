import { inflateRawSync } from "node:zlib";
import { buildKnowledgeImportPreview, DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES, validateKnowledgeUploadFile, type KnowledgeImportPreview } from "@/lib/knowledge/import";

export type ExtractionResult = {
  sourceText: string;
  detectedFileType: "TXT" | "MD" | "PDF" | "DOCX";
  sourceMimeType: string;
  warnings: string[];
};

function decodeUtf8(buffer: Buffer) {
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer).replace(/^\uFEFF/, "");
}

function xmlText(value: string) {
  return value
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function readUInt64ish(buffer: Buffer, offset: number) {
  return buffer.readUInt32LE(offset);
}

function findZipEntry(buffer: Buffer, name: string) {
  for (let offset = 0; offset < buffer.length - 46; offset += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) continue;
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = readUInt64ish(buffer, offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = readUInt64ish(buffer, offset + 42);
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    offset += 45 + fileNameLength + extraLength + commentLength;
    if (fileName !== name) continue;
    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) return null;
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    if (compression === 0) return compressed;
    if (compression === 8) return inflateRawSync(compressed);
    return null;
  }
  return null;
}

function extractDocx(buffer: Buffer) {
  const documentXml = findZipEntry(buffer, "word/document.xml");
  if (!documentXml) return "";
  return xmlText(decodeUtf8(documentXml));
}

function decodePdfEscapes(value: string) {
  return value
    .replace(/\\([nrtbf()\\])/g, (_, token: string) => ({ n: "\n", r: "\r", t: "\t", b: "", f: "", "(": "(", ")": ")", "\\": "\\" })[token] ?? token)
    .replace(/\\([0-7]{1,3})/g, (_, octal: string) => String.fromCharCode(parseInt(octal, 8)));
}

function extractPdf(buffer: Buffer) {
  const latin = buffer.toString("latin1");
  const strings = [...latin.matchAll(/\((?:\\.|[^\\)]){2,}\)\s*Tj/g)].map((match) => decodePdfEscapes(match[0].replace(/\)\s*Tj$/, "").slice(1)));
  const arrayStrings = [...latin.matchAll(/\[((?:\s*\((?:\\.|[^\\)])+\)\s*)+)\]\s*TJ/g)].flatMap((match) => [...match[1].matchAll(/\((?:\\.|[^\\)])+\)/g)].map((part) => decodePdfEscapes(part[0].slice(1, -1))));
  return [...strings, ...arrayStrings].join(" ").replace(/\s+/g, " ").trim();
}

export async function extractKnowledgeFile(file: File): Promise<ExtractionResult> {
  const validationError = validateKnowledgeUploadFile({ name: file.name, type: file.type, size: file.size });
  if (validationError) throw new Error(validationError);
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  const warnings: string[] = [];
  let sourceText = "";
  let detectedFileType: ExtractionResult["detectedFileType"] = "TXT";
  let sourceMimeType = file.type || "application/octet-stream";

  if (name.endsWith(".txt")) { sourceText = decodeUtf8(buffer); detectedFileType = "TXT"; sourceMimeType = file.type || "text/plain"; }
  else if (name.endsWith(".md")) { sourceText = decodeUtf8(buffer); detectedFileType = "MD"; sourceMimeType = file.type || "text/markdown"; }
  else if (name.endsWith(".docx")) { sourceText = extractDocx(buffer); detectedFileType = "DOCX"; sourceMimeType = file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; }
  else if (name.endsWith(".pdf")) { sourceText = extractPdf(buffer); detectedFileType = "PDF"; sourceMimeType = file.type || "application/pdf"; }

  sourceText = sourceText.replace(/\u0000/g, "").trim();
  if (detectedFileType === "PDF" && !sourceText) warnings.push("No selectable text was found. This may be a scanned document. OCR is not yet supported.");
  if (sourceText.length > 0 && sourceText.length < 200) warnings.push("Extracted text is short. Review the preview before importing.");
  if (!sourceText) warnings.push("No useful text was extracted. Review the file or convert it to text before importing.");
  return { sourceText, detectedFileType, sourceMimeType, warnings };
}

export async function buildKnowledgeFilePreview(file: File): Promise<KnowledgeImportPreview> {
  const result = await extractKnowledgeFile(file);
  return buildKnowledgeImportPreview({
    clientId: `${file.name}-${file.size}-${Date.now()}`,
    name: file.name,
    type: result.sourceMimeType,
    size: file.size,
    text: result.sourceText || "Imported source-of-truth document.",
    detectedFileType: result.detectedFileType,
    extractionStatus: result.sourceText ? "EXTRACTED" : "WARNING",
    extractionWarnings: result.warnings
  });
}

export { DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES };
