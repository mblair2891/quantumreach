import { createHash, createHmac, randomUUID } from "node:crypto";

export type StoredKnowledgeObject = {
  key: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export class KnowledgeStorageError extends Error {
  constructor(message = "Original file storage is unavailable. Please try again later.") {
    super(message);
    this.name = "KnowledgeStorageError";
  }
}

type R2Config = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function getConfig(): R2Config {
  const bucket = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : "");
  if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) throw new KnowledgeStorageError();
  return { bucket, accessKeyId, secretAccessKey, endpoint: endpoint.replace(/\/$/, "") };
}

export function sanitizeStorageFileName(fileName: string) {
  const cleaned = fileName.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/\.{2,}/g, ".").replace(/^[.-]+|[.-]+$/g, "").slice(0, 160);
  return cleaned || "source-file";
}

export function buildKnowledgeOriginalStorageKey(workspaceId: string, documentId: string, fileName: string) {
  return `workspaces/${encodeURIComponent(workspaceId)}/knowledge-documents/${encodeURIComponent(documentId)}/original/${randomUUID()}-${sanitizeStorageFileName(fileName)}`;
}

export function isWorkspaceKnowledgeStorageKey(storageKey: string | null | undefined, workspaceId: string, documentId: string) {
  return Boolean(storageKey?.startsWith(`workspaces/${encodeURIComponent(workspaceId)}/knowledge-documents/${encodeURIComponent(documentId)}/original/`));
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function hash(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function amzDate(now = new Date()) {
  return now.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function dateStamp(amz: string) {
  return amz.slice(0, 8);
}

function signingKey(secret: string, date: string) {
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, "auto");
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function encodePathPart(value: string) {
  return value.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function signedHeaders(headers: Record<string, string>) {
  return Object.keys(headers).map((header) => header.toLowerCase()).sort();
}

async function r2Fetch(method: "PUT" | "GET" | "DELETE", key: string, body?: Buffer, contentType?: string) {
  const config = getConfig();
  const amz = amzDate();
  const date = dateStamp(amz);
  const payloadHash = hash(body ?? "");
  const url = new URL(`${config.endpoint}/${config.bucket}/${encodePathPart(key)}`);
  const headers: Record<string, string> = { host: url.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amz };
  if (contentType) headers["content-type"] = contentType;
  const signed = signedHeaders(headers);
  const canonicalHeaders = signed.map((header) => `${header}:${headers[header] ?? headers[header.toLowerCase()]}`).join("\n") + "\n";
  const canonicalRequest = [method, url.pathname, "", canonicalHeaders, signed.join(";"), payloadHash].join("\n");
  const scope = `${date}/auto/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amz, scope, hash(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(config.secretAccessKey, date)).update(stringToSign).digest("hex");
  const response = await fetch(url, { method, body: body ? new Uint8Array(body) : undefined, headers: { ...headers, Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signed.join(";")}, Signature=${signature}` } });
  if (!response.ok) throw new KnowledgeStorageError();
  return response;
}

export async function putKnowledgeOriginalFile(input: { workspaceId: string; documentId: string; file: File; fileName?: string; mimeType?: string }): Promise<StoredKnowledgeObject> {
  const fileName = input.fileName || input.file.name;
  const mimeType = input.mimeType || input.file.type || "application/octet-stream";
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const key = buildKnowledgeOriginalStorageKey(input.workspaceId, input.documentId, fileName);
  await r2Fetch("PUT", key, buffer, mimeType);
  return { key, fileName, mimeType, sizeBytes: input.file.size };
}

export async function getKnowledgeOriginalFile(storageKey: string) {
  return r2Fetch("GET", storageKey);
}

export async function deleteKnowledgeOriginalFile(storageKey: string) {
  await r2Fetch("DELETE", storageKey);
}
