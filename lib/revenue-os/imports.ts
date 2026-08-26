import { prisma } from "@/lib/db/prisma";
import { toPrismaJson } from "@/lib/db/json";
import {
  hygienizeRows,
  mapContactRow,
  parseCsv,
  rejectsCsv,
  summarizeHygiene,
  type CsvRow,
  type HygienizedRow,
} from "@/lib/contacts/hygiene";
import {
  loadHygieneContext,
  persistHygienizedContact,
  toRowCreateData,
  type ExistingContact,
} from "@/lib/contacts/ingest";

export type { CsvRow };
export { mapContactRow, parseCsv, rejectsCsv };

export async function validateImportRows(workspaceId: string, rows: CsvRow[], db: typeof prisma = prisma) {
  const emails = rows.map((row) => mapContactRow(row).email);
  const context = await loadHygieneContext(workspaceId, emails, db);
  return hygienizeRows(rows, { ...context, titleCaseNames: true });
}

function countsFrom(rows: HygienizedRow[]) {
  const summary = summarizeHygiene(rows);
  return {
    rowCount: summary.rowCount,
    validCount: summary.validCount,
    invalidCount: summary.rowCount - summary.validCount,
    readyCount: summary.readyCount,
    needsReviewCount: summary.needsReviewCount,
    suppressedCount: summary.suppressedCount,
    mergedCount: summary.mergedCount,
  };
}

export async function createImportPreview(
  workspaceId: string,
  rows: CsvRow[],
  opts: { fileName?: string; listName?: string; createdById?: string } = {},
  db: typeof prisma = prisma,
) {
  const validated = await validateImportRows(workspaceId, rows, db);
  const counts = countsFrom(validated);
  return db.contactImportBatch.create({
    data: {
      workspaceId,
      fileName: opts.fileName,
      listName: opts.listName,
      createdById: opts.createdById,
      ...counts,
      rows: { create: validated.map((row) => toRowCreateData(workspaceId, row)) },
    },
    include: { rows: true },
  });
}

export async function createImportPreviewFromCsv(
  workspaceId: string,
  csv: string,
  opts: { fileName?: string; listName?: string; createdById?: string } = {},
  db: typeof prisma = prisma,
) {
  const rows = parseCsv(csv);
  if (!rows.length) throw new Error("CSV is empty.");
  return createImportPreview(workspaceId, rows, opts, db);
}

function mappedFromJson(value: unknown) {
  const object = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const text = (key: string) => {
    const valueAtKey = object[key];
    return typeof valueAtKey === "string" && valueAtKey.trim() ? valueAtKey : undefined;
  };
  return {
    email: text("email") ?? "",
    firstName: text("firstName") ?? "",
    lastName: text("lastName") ?? "",
    phone: text("phone"),
    title: text("title"),
    company: text("company") ?? "",
    companyRaw: text("companyRaw"),
    companyDomain: text("companyDomain"),
    website: text("website"),
    industry: text("industry"),
    linkedInUrl: text("linkedInUrl"),
    location: text("location"),
    notes: text("notes"),
  };
}

function flagsFromJson(value: unknown) {
  return Array.isArray(value) ? value.filter((flag): flag is string => typeof flag === "string") : [];
}

export async function commitImportBatch(
  workspaceId: string,
  batchId: string,
  complianceAttested: boolean,
  options: { readyOnly?: boolean } = {},
  db: typeof prisma = prisma,
): Promise<{ listId: string | null; committedCount: number; status: string }> {
  if (!complianceAttested) throw new Error("Compliance attestation is required before imported contacts become campaign-eligible.");
  const readyOnly = options.readyOnly ?? true;
  const batch = await db.contactImportBatch.findFirst({ where: { id: batchId, workspaceId }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
  if (!batch) throw new Error("Import batch not found.");
  if (batch.status === "COMMITTED") return { listId: null, committedCount: 0, status: batch.status };

  const emails = batch.rows.map((row) => mappedFromJson(row.mapped).email).filter(Boolean);
  const context = await loadHygieneContext(workspaceId, emails, db);
  const existingByEmail = context.existingByEmail;
  const committedIds: Array<{ rowId: string; contactId: string }> = [];

  for (const row of batch.rows) {
    const mapped = mappedFromJson(row.mapped);
    const flags = flagsFromJson(row.issues);
    const isPrimary = !flags.includes("duplicate_in_upload");
    const status = row.hygieneStatus;
    if (!isPrimary) continue;
    if (readyOnly && status !== "READY") continue;
    if (status === "INVALID") continue;

    const existing = mapped.email ? existingByEmail.get(mapped.email) ?? null : null;
    const contact = await persistHygienizedContact(
      {
        workspaceId,
        mapped,
        hygieneStatus: status,
        flags,
        source: "IMPORTED_CSV",
        sourceEvent: {
          source: "IMPORTED_CSV",
          at: new Date().toISOString(),
          fileName: batch.fileName ?? undefined,
          batchId: batch.id,
          rowNumber: row.rowNumber,
          listName: batch.listName ?? undefined,
        },
        createdById: batch.createdById,
        existing,
      },
      db,
    );
    committedIds.push({ rowId: row.id, contactId: contact.id });
    if (contact.email) {
      existingByEmail.set(contact.email, {
        id: contact.id,
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phone,
        title: contact.title,
        companyRaw: contact.companyRaw,
        companyDomain: contact.companyDomain,
        hygieneStatus: contact.hygieneStatus,
        hygieneFlags: contact.hygieneFlags,
        sourceDetail: contact.sourceDetail,
      } satisfies ExistingContact);
    }
    await db.contactImportRow.update({ where: { id: row.id }, data: { committedContactId: contact.id } });
  }

  let listId: string | null = null;
  if (batch.listName?.trim()) {
    const list = await db.outboundList.create({ data: { workspaceId, name: batch.listName.trim() } });
    listId = list.id;
    const uniqueContactIds = [...new Set(committedIds.map((row) => row.contactId))];
    for (const contactId of uniqueContactIds) {
      await db.outboundListMember.create({ data: { listId: list.id, contactId } }).catch(() => undefined);
    }
  }

  const updated = await db.contactImportBatch.update({
    where: { id: batchId },
    data: {
      status: "COMMITTED",
      complianceAttested: true,
      readyOnlyCommitted: readyOnly,
      attestationText: "User attested they have lawful authority to contact imported contacts.",
      committedAt: new Date(),
    },
  });
  return { listId, committedCount: committedIds.length, status: updated.status };
}

export function flaggedSample(rows: HygienizedRow[], limit = 10) {
  return rows.filter((row) => !row.isValid).slice(0, limit);
}

export function importRowsFromBatch(batch: { rows: Array<{ rowNumber: number; raw: unknown; mapped: unknown; issues: unknown; isValid: boolean; hygieneStatus: string }> }): HygienizedRow[] {
  return batch.rows.map((row) => {
    const mapped = mappedFromJson(row.mapped);
    const flags = flagsFromJson(row.issues);
    const raw = row.raw && typeof row.raw === "object" && !Array.isArray(row.raw) ? (row.raw as CsvRow) : {};
    return {
      rowNumber: row.rowNumber,
      raw,
      mapped,
      flags: flags as HygienizedRow["flags"],
      issues: flags as HygienizedRow["flags"],
      hygieneStatus: row.hygieneStatus as HygienizedRow["hygieneStatus"],
      isPrimary: !flags.includes("duplicate_in_upload"),
      isValid: row.isValid,
    };
  });
}
