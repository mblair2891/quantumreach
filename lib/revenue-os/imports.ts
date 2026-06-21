/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
import { normalizeEmail, isSuppressed } from "./email";
const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export type CsvRow = Record<string, string | undefined>;
export function mapContactRow(row: CsvRow) {
  const pick = (...keys: string[]) => keys.map((k) => row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()]).find(Boolean)?.trim();
  return { firstName: pick("first name", "firstName", "first_name") ?? "", lastName: pick("last name", "lastName", "last_name") ?? "", email: normalizeEmail(pick("email", "Email") ?? ""), phone: pick("phone"), title: pick("title"), company: pick("company", "account"), website: pick("website", "domain"), linkedInUrl: pick("linkedin", "linkedin url"), industry: pick("industry"), location: pick("location"), notes: pick("notes") };
}
export async function validateImportRows(workspaceId: string, rows: CsvRow[]) {
  const seen = new Set<string>();
  return Promise.all(rows.map(async (raw, i) => {
    const mapped = mapContactRow(raw); const issues: string[] = [];
    if (!mapped.email || !emailRe.test(mapped.email)) issues.push("invalid_email");
    if (!mapped.firstName && !mapped.lastName) issues.push("missing_name");
    if (mapped.email && seen.has(mapped.email)) issues.push("duplicate_in_upload");
    if (mapped.email) seen.add(mapped.email);
    if (mapped.email && await (prisma as any).contact.count({ where: { workspaceId, email: mapped.email } })) issues.push("duplicate_in_workspace");
    if (mapped.email && await isSuppressed(workspaceId, mapped.email)) issues.push("suppressed");
    return { rowNumber: i + 1, raw, mapped, issues, isValid: issues.length === 0 };
  }));
}
export async function createImportPreview(workspaceId: string, rows: CsvRow[], opts: { fileName?: string; createdById?: string } = {}) {
  const validated = await validateImportRows(workspaceId, rows);
  return (prisma as any).contactImportBatch.create({ data: { workspaceId, fileName: opts.fileName, rowCount: rows.length, validCount: validated.filter(r => r.isValid).length, invalidCount: validated.filter(r => !r.isValid).length, createdById: opts.createdById, rows: { create: validated.map((r) => ({ workspaceId, rowNumber: r.rowNumber, raw: r.raw, mapped: r.mapped, issues: r.issues, isValid: r.isValid, dedupeKey: r.mapped.email })) } }, include: { rows: true } });
}
export async function commitImportBatch(workspaceId: string, batchId: string, complianceAttested: boolean) {
  if (!complianceAttested) throw new Error("Compliance attestation is required before imported contacts become campaign-eligible.");
  const batch = await (prisma as any).contactImportBatch.findFirst({ where: { id: batchId, workspaceId }, include: { rows: true } });
  if (!batch) throw new Error("Import batch not found.");
  const validRows = batch.rows.filter((r: any) => r.isValid);
  for (const row of validRows) {
    const m = row.mapped;
    const company = m.company ? await (prisma as any).company.upsert({ where: { workspaceId_name: { workspaceId, name: m.company } }, update: { domain: m.website, industry: m.industry }, create: { workspaceId, name: m.company, domain: m.website, industry: m.industry } }).catch(() => null) : null;
    const contact = await (prisma as any).contact.create({ data: { workspaceId, firstName: m.firstName || "Unknown", lastName: m.lastName || "Contact", email: m.email, phone: m.phone, title: m.title, companyId: company?.id } });
    await (prisma as any).contactImportRow.update({ where: { id: row.id }, data: { committedContactId: contact.id } });
  }
  return (prisma as any).contactImportBatch.update({ where: { id: batchId }, data: { status: "COMMITTED", complianceAttested: true, attestationText: "User attested they have lawful authority to contact imported contacts.", committedAt: new Date() } });
}
