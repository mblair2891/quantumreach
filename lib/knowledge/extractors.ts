import { inflateRawSync, inflateSync } from "node:zlib";
import {
  buildKnowledgeImportPreview,
  DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES,
  validateKnowledgeUploadFile,
  type KnowledgeImportPreview,
} from "@/lib/knowledge/import";

export type ExtractionResult = {
  sourceText: string;
  detectedFileType: "TXT" | "MD" | "PDF" | "DOCX";
  sourceMimeType: string;
  warnings: string[];
};

type PdfToken =
  | { type: "string"; value: string }
  | { type: "array"; value: PdfToken[] }
  | { type: "operator"; value: string };

const PDF_OCR_UNSUPPORTED_WARNING =
  "No selectable text was found. This may be a scanned document. OCR is not yet supported.";
const PDF_PARSE_FALLBACK_WARNING =
  "PDF text extraction was partially limited. Review the preview before importing.";
const PDF_UNREADABLE_TEXT_WARNING =
  "Text was detected, but it could not be decoded into readable content. Try converting this PDF to TXT or DOCX before importing.";

const COMMON_READABLE_WORDS = new Set([
  "about",
  "above",
  "after",
  "again",
  "all",
  "also",
  "analysis",
  "and",
  "architecture",
  "are",
  "asset",
  "before",
  "business",
  "call",
  "client",
  "content",
  "conversion",
  "customer",
  "data",
  "description",
  "diagnostic",
  "document",
  "draft",
  "during",
  "each",
  "execution",
  "extracted",
  "file",
  "for",
  "framework",
  "from",
  "handoff",
  "has",
  "have",
  "import",
  "into",
  "knowledge",
  "markdown",
  "metadata",
  "methodology",
  "normal",
  "operating",
  "outreach",
  "page",
  "pdf",
  "phase",
  "preview",
  "proposal",
  "reach",
  "readable",
  "reliably",
  "report",
  "review",
  "roadmap",
  "rollout",
  "selectable",
  "source",
  "status",
  "strategy",
  "supported",
  "text",
  "the",
  "this",
  "truth",
  "upload",
  "useful",
  "version",
  "with",
  "workflow",
]);

function vowelRatio(value: string) {
  const alpha = value.match(/[A-Za-z]/g) ?? [];
  if (!alpha.length) return 0;
  const vowels = alpha.filter((character) => /[AEIOUYaeiouy]/.test(character));
  return vowels.length / alpha.length;
}

function hasReadableWordShape(word: string) {
  const trimmed = word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "");
  const lower = trimmed.toLowerCase();
  if (lower.length < 3) return false;
  if (COMMON_READABLE_WORDS.has(lower)) return true;
  if (/^[A-Z]{4,}$/.test(trimmed)) return false;
  if (!/[aeiouy]/.test(lower)) return false;
  if (
    /^[a-z]+(?:ing|tion|ment|ness|able|ible|ally|ed|er|est|ous|ive|ize|ise|ity|ies|al|ic|ance|ence|ship|ary|ory|ate|ure|ent|ant|ful|less|ism|ist|ize|ise|ify)$/.test(
      lower,
    )
  )
    return true;
  if (
    /^(pre|post|re|un|non|over|under|inter|intra|trans|micro|macro|auto|anti|multi)[a-z]{4,}$/.test(
      lower,
    )
  )
    return true;
  return (
    lower.length >= 5 &&
    /[aeiouy].*[bcdfghjklmnpqrstvwxz]|[bcdfghjklmnpqrstvwxz].*[aeiouy]/.test(
      lower,
    )
  );
}

function isProbablyReadablePdfText(value: string) {
  const text = normalizeExtractedText(value);
  if (!text) return false;

  const alphaCharacters = text.match(/[A-Za-z]/g) ?? [];
  if (alphaCharacters.length < 8) return false;

  const artifactCharacters =
    text.match(
      /[\uFFFD\uE000-\uF8FF\u0001-\u0008\u000B\u000C\u000E-\u001F]/g,
    ) ?? [];
  if (artifactCharacters.length / Math.max(text.length, 1) > 0.02) return false;

  const nonTextCharacters =
    text.match(/[^\p{L}\p{N}\s.,;:!?@#$%&*()[\]{}'"“”‘’/\\_+\-=–—<>|\n]/gu) ??
    [];
  if (nonTextCharacters.length / Math.max(text.length, 1) > 0.05) return false;

  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const singleCharacterLines = lines.filter((line) => /^[A-Za-z]$/.test(line));
  if (lines.length >= 12 && singleCharacterLines.length / lines.length > 0.6)
    return false;

  const words = text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
  if (words.length < 2) return false;

  const ratio = vowelRatio(text);
  const longWords = words.filter(
    (word) => word.replace(/[^A-Za-z]/g, "").length >= 4,
  );
  const recognizableWords = words.filter(hasReadableWordShape);
  const recognizableRatio =
    recognizableWords.length / Math.max(words.length, 1);
  const uppercaseOrEncodedTokens = text.match(/\b[0-9A-Z'’]{4,}\b/g) ?? [];
  const randomCapitalTokens = uppercaseOrEncodedTokens.filter((token) => {
    const letters = token.match(/[A-Z]/g) ?? [];
    if (letters.length < 3) return false;
    const hasDigit = /\d/.test(token);
    const tokenVowelRatio = vowelRatio(token);
    return hasDigit || tokenVowelRatio < 0.22;
  });

  if (
    randomCapitalTokens.length >= 2 &&
    randomCapitalTokens.length / Math.max(longWords.length, 1) > 0.45 &&
    recognizableRatio < 0.5
  )
    return false;

  if (words.length >= 5 && ratio < 0.18 && recognizableRatio < 0.5)
    return false;
  if (words.length >= 3 && recognizableRatio < 0.12 && ratio < 0.3)
    return false;
  if (longWords.length >= 3 && recognizableWords.length === 0) return false;

  return true;
}

function decodeUtf8(buffer: Buffer) {
  return new TextDecoder("utf-8", { fatal: false })
    .decode(buffer)
    .replace(/^\uFEFF/, "");
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
    const fileName = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString("utf8");
    offset += 45 + fileNameLength + extraLength + commentLength;
    if (fileName !== name) continue;
    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) return null;
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart =
      localHeaderOffset + 30 + localNameLength + localExtraLength;
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

function normalizeExtractedText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodePdfEscapes(value: string) {
  return value
    .replace(/\\\r\n/g, "")
    .replace(/\\[\r\n]/g, "")
    .replace(
      /\\([nrtbf()\\])/g,
      (_, token: string) =>
        ({
          n: "\n",
          r: "\r",
          t: "\t",
          b: "",
          f: "",
          "(": "(",
          ")": ")",
          "\\": "\\",
        })[token] ?? token,
    )
    .replace(/\\([0-7]{1,3})/g, (_, octal: string) =>
      String.fromCharCode(parseInt(octal, 8)),
    );
}

function decodePdfBytes(bytes: number[]) {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let value = "";
    for (let index = 2; index + 1 < bytes.length; index += 2)
      value += String.fromCharCode((bytes[index] << 8) | bytes[index + 1]);
    return value;
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return Buffer.from(bytes.slice(2)).toString("utf16le");
  }
  return Buffer.from(bytes).toString("latin1");
}

function decodePdfLiteral(value: string) {
  const decoded = decodePdfEscapes(value);
  return decodePdfBytes(
    [...decoded].map((character) => character.charCodeAt(0) & 0xff),
  );
}

function decodePdfHex(value: string) {
  const clean = value.replace(/\s+/g, "");
  const padded = clean.length % 2 === 0 ? clean : `${clean}0`;
  const bytes: number[] = [];
  for (let index = 0; index < padded.length; index += 2)
    bytes.push(parseInt(padded.slice(index, index + 2), 16));
  return decodePdfBytes(bytes.filter((byte) => Number.isFinite(byte)));
}

function isPdfWhitespace(character: string) {
  return (
    character === " " ||
    character === "\n" ||
    character === "\r" ||
    character === "\t" ||
    character === "\f" ||
    character === "\0"
  );
}

function readPdfLiteral(source: string, start: number) {
  let depth = 1;
  let index = start + 1;
  let value = "";
  while (index < source.length && depth > 0) {
    const character = source[index];
    if (character === "\\") {
      value += character;
      if (index + 1 < source.length) value += source[index + 1];
      index += 2;
      continue;
    }
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (depth > 0) value += character;
    index += 1;
  }
  return {
    token: {
      type: "string",
      value: decodePdfLiteral(value),
    } satisfies PdfToken,
    next: index,
  };
}

function readPdfHex(source: string, start: number) {
  const end = source.indexOf(">", start + 1);
  if (end === -1)
    return {
      token: { type: "string", value: "" } satisfies PdfToken,
      next: source.length,
    };
  return {
    token: {
      type: "string",
      value: decodePdfHex(source.slice(start + 1, end)),
    } satisfies PdfToken,
    next: end + 1,
  };
}

function readPdfWord(source: string, start: number) {
  let index = start;
  while (
    index < source.length &&
    !isPdfWhitespace(source[index]) &&
    !"[]<>()/%".includes(source[index])
  )
    index += 1;
  return { word: source.slice(start, index), next: index };
}

function tokenizePdfContent(
  source: string,
  start = 0,
  stopAtArrayEnd = false,
): { tokens: PdfToken[]; next: number } {
  const tokens: PdfToken[] = [];
  let index = start;
  while (index < source.length) {
    const character = source[index];
    if (isPdfWhitespace(character)) {
      index += 1;
      continue;
    }
    if (character === "%") {
      const newline = source.slice(index).search(/[\r\n]/);
      index = newline === -1 ? source.length : index + newline + 1;
      continue;
    }
    if (stopAtArrayEnd && character === "]") return { tokens, next: index + 1 };
    if (character === "(") {
      const { token, next } = readPdfLiteral(source, index);
      tokens.push(token);
      index = next;
      continue;
    }
    if (character === "<" && source[index + 1] !== "<") {
      const { token, next } = readPdfHex(source, index);
      tokens.push(token);
      index = next;
      continue;
    }
    if (character === "[") {
      const { tokens: value, next } = tokenizePdfContent(
        source,
        index + 1,
        true,
      );
      tokens.push({ type: "array", value });
      index = next;
      continue;
    }
    if (character === "'" || character === '"') {
      tokens.push({ type: "operator", value: character });
      index += 1;
      continue;
    }
    const { word, next } = readPdfWord(source, index);
    if (word) tokens.push({ type: "operator", value: word });
    index = next > index ? next : index + 1;
  }
  return { tokens, next: index };
}

function textFromPdfTokens(tokens: PdfToken[]) {
  const chunks: string[] = [];
  const stack: PdfToken[] = [];
  for (const token of tokens) {
    if (token.type !== "operator") {
      stack.push(token);
      continue;
    }

    if (token.value === "Tj" || token.value === "'" || token.value === '"') {
      const candidate = [...stack]
        .reverse()
        .find((item) => item.type === "string");
      if (candidate?.type === "string" && candidate.value.trim())
        chunks.push(candidate.value);
    }
    if (token.value === "TJ") {
      const candidate = [...stack]
        .reverse()
        .find((item) => item.type === "array");
      if (candidate?.type === "array") {
        const value = candidate.value
          .filter(
            (item): item is Extract<PdfToken, { type: "string" }> =>
              item.type === "string",
          )
          .map((item) => item.value)
          .join("");
        if (value.trim()) chunks.push(value);
      }
    }
    if (token.value === "T*" || token.value === "Td" || token.value === "TD")
      chunks.push("\n");
    if (["Tj", "TJ", "'", '"', "T*", "Td", "TD", "ET"].includes(token.value))
      stack.length = 0;
  }
  return normalizeExtractedText(chunks.join(" "));
}

function getPdfStreamBuffers(buffer: Buffer) {
  const latin = buffer.toString("latin1");
  const streams: Buffer[] = [];
  const objectPattern = /\d+\s+\d+\s+obj\b([\s\S]*?)endobj/g;
  for (const match of latin.matchAll(objectPattern)) {
    const objectBody = match[1];
    const streamIndex = objectBody.indexOf("stream");
    if (streamIndex === -1) continue;
    const endStreamIndex = objectBody.indexOf("endstream", streamIndex);
    if (endStreamIndex === -1) continue;

    const dictionary = objectBody.slice(0, streamIndex);
    let dataStart = streamIndex + "stream".length;
    if (objectBody[dataStart] === "\r" && objectBody[dataStart + 1] === "\n")
      dataStart += 2;
    else if (objectBody[dataStart] === "\n" || objectBody[dataStart] === "\r")
      dataStart += 1;
    let dataEnd = endStreamIndex;
    if (objectBody[dataEnd - 2] === "\r" && objectBody[dataEnd - 1] === "\n")
      dataEnd -= 2;
    else if (
      objectBody[dataEnd - 1] === "\n" ||
      objectBody[dataEnd - 1] === "\r"
    )
      dataEnd -= 1;

    const stream = Buffer.from(objectBody.slice(dataStart, dataEnd), "latin1");
    if (/\/FlateDecode\b/.test(dictionary)) {
      try {
        streams.push(inflateSync(stream));
      } catch {
        // Ignore an individual malformed stream and continue with any other readable streams.
      }
    } else if (!/\/Filter\b/.test(dictionary)) {
      streams.push(stream);
    }
  }
  return streams;
}

function extractPdfWithContentStreams(buffer: Buffer) {
  let textOperatorCount = 0;
  const sourceText = normalizeExtractedText(
    getPdfStreamBuffers(buffer)
      .map((stream) => {
        const tokens = tokenizePdfContent(stream.toString("latin1")).tokens;
        textOperatorCount += tokens.filter(
          (token) =>
            token.type === "operator" &&
            ["Tj", "TJ", "\'", '"'].includes(token.value),
        ).length;
        return textFromPdfTokens(tokens);
      })
      .filter(Boolean)
      .join("\n"),
  );
  return { sourceText, textDetected: textOperatorCount > 0 };
}

function extractPdfWithLightweightFallback(buffer: Buffer) {
  const latin = buffer.toString("latin1");
  const strings = [...latin.matchAll(/\((?:\\.|[^\\)]){2,}\)\s*Tj/g)].map(
    (match) => decodePdfLiteral(match[0].replace(/\)\s*Tj$/, "").slice(1)),
  );
  const arrayStrings = [
    ...latin.matchAll(/\[((?:\s*\((?:\\.|[^\\)])+\)\s*)+)\]\s*TJ/g),
  ].flatMap((match) =>
    [...match[1].matchAll(/\((?:\\.|[^\\)])+\)/g)].map((part) =>
      decodePdfLiteral(part[0].slice(1, -1)),
    ),
  );
  return normalizeExtractedText([...strings, ...arrayStrings].join(" "));
}

function extractPdf(buffer: Buffer) {
  const warnings: string[] = [];
  let textDetected = false;
  let sourceText = "";
  try {
    const contentStreamResult = extractPdfWithContentStreams(buffer);
    textDetected = contentStreamResult.textDetected;
    sourceText =
      contentStreamResult.sourceText ||
      extractPdfWithLightweightFallback(buffer);
  } catch {
    warnings.push(PDF_PARSE_FALLBACK_WARNING);
    sourceText = extractPdfWithLightweightFallback(buffer);
    textDetected = Boolean(sourceText);
  }

  sourceText = normalizeExtractedText(sourceText);
  if (sourceText && !isProbablyReadablePdfText(sourceText)) {
    warnings.push(PDF_UNREADABLE_TEXT_WARNING);
    return { sourceText: "", warnings, textDetected: true };
  }
  if (!sourceText && textDetected) warnings.push(PDF_UNREADABLE_TEXT_WARNING);
  return { sourceText, warnings, textDetected };
}

export async function extractKnowledgeFile(
  file: File,
): Promise<ExtractionResult> {
  const validationError = validateKnowledgeUploadFile({
    name: file.name,
    type: file.type,
    size: file.size,
  });
  if (validationError) throw new Error(validationError);
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  const warnings: string[] = [];
  let sourceText = "";
  let detectedFileType: ExtractionResult["detectedFileType"] = "TXT";
  let sourceMimeType = file.type || "application/octet-stream";

  if (name.endsWith(".txt")) {
    sourceText = decodeUtf8(buffer);
    detectedFileType = "TXT";
    sourceMimeType = file.type || "text/plain";
  } else if (name.endsWith(".md")) {
    sourceText = decodeUtf8(buffer);
    detectedFileType = "MD";
    sourceMimeType = file.type || "text/markdown";
  } else if (name.endsWith(".docx")) {
    sourceText = extractDocx(buffer);
    detectedFileType = "DOCX";
    sourceMimeType =
      file.type ||
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else if (name.endsWith(".pdf")) {
    const result = extractPdf(buffer);
    sourceText = result.sourceText;
    warnings.push(...result.warnings);
    detectedFileType = "PDF";
    sourceMimeType = file.type || "application/pdf";
  }

  sourceText = normalizeExtractedText(sourceText);
  if (
    detectedFileType === "PDF" &&
    !sourceText &&
    !warnings.includes(PDF_UNREADABLE_TEXT_WARNING)
  )
    warnings.push(PDF_OCR_UNSUPPORTED_WARNING);
  if (sourceText.length > 0 && sourceText.length < 200)
    warnings.push(
      "Extracted text is short. Review the preview before importing.",
    );
  if (!sourceText)
    warnings.push(
      "No useful text was extracted. Review the file or convert it to text before importing.",
    );
  return { sourceText, detectedFileType, sourceMimeType, warnings };
}

export async function buildKnowledgeFilePreview(
  file: File,
): Promise<KnowledgeImportPreview> {
  const result = await extractKnowledgeFile(file);
  return buildKnowledgeImportPreview({
    clientId: `${file.name}-${file.size}-${Date.now()}`,
    name: file.name,
    type: result.sourceMimeType,
    size: file.size,
    text: result.sourceText,
    detectedFileType: result.detectedFileType,
    extractionStatus: result.sourceText ? "EXTRACTED" : "WARNING",
    extractionWarnings: result.warnings,
  });
}

export { DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES };
