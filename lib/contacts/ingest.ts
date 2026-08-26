import type { ContactHygieneStatus, ContactSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { toPrismaJson } from "@/lib/db/json";
import {
  classifyMapped,
  hygienizeRows,
  isValidEmailSyntax,
  mergeMapped,
  mergeSourceDetail,
  normalizeEmail,
  normalizeName,
  requiredFieldsFromSettings,
  sanitizeCompany,
  summarizeHygiene,
  type CsvRow,
  type ExistingContact,
  type HygienizedContact,
  type HygienizedRow,
  type SourceEvent,
} from "./hygiene";

type Db = typeof prisma;

export type IngestSource = ContactSource;

function asFlags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((flag): flag is string => typeof flag === "string") : [];
}

export async function loadHygieneContext(workspaceId: string, emails: string[], db: Db = prisma) {
  const unique = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  const [existing, suppressed, workspace] = await Promise.all([
    unique.length
      ? db.contact.findMany({
          where: { workspaceId, email: { in: unique } },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            title: true,
            companyRaw: true,
            companyDomain: true,
            hygieneStatus: true,
            hygieneFlags: true,
            sourceDetail: true,
          },
        })
      : Promise.resolve([]),
    unique.length
      ? db.suppressionListEntry.findMany({ where: { workspaceId, email: { in: unique } }, select: { email: true } })
      : Promise.resolve([]),
    db.workspace.findUnique({ where: { id: workspaceId }, select: { settings: true } }),
  ]);
  return {
    existingByEmail: new Map(existing.filter((row) => row.email).map((row) => [normalizeEmail(row.email!), row as ExistingContact])),
    suppressedEmails: new Set(suppressed.map((row) => normalizeEmail(row.email))),
    requiredFields: requiredFieldsFromSettings(workspace?.settings),
  };
}

export async function hygienizeWorkspaceRows(
  workspaceId: string,
  rows: CsvRow[],
  options: { titleCaseNames?: boolean } = {},
  db: Db = prisma,
) {
  const mappedEmails = rows.map((row) => normalizeEmail(String(row.email ?? row.Email ?? "")));
  const context = await loadHygieneContext(workspaceId, mappedEmails, db);
  return hygienizeRows(rows, { ...context, titleCaseNames: options.titleCaseNames ?? true });
}

function existingToMapped(existing: ExistingContact): HygienizedContact {
  const companyInput = existing.companyRaw ?? "";
  const sanitized = sanitizeCompany(companyInput);
  return {
    email: existing.email ? normalizeEmail(existing.email) : "",
    firstName: existing.firstName ?? "",
    lastName: existing.lastName ?? "",
    phone: existing.phone ?? undefined,
    title: existing.title ?? undefined,
    company: sanitized.company,
    companyRaw: existing.companyRaw ?? sanitized.companyRaw,
    companyDomain: existing.companyDomain ?? undefined,
  };
}

export function contactFromInput(input: {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  title?: string | null;
  company?: string | null;
  companyRaw?: string | null;
  companyDomain?: string | null;
}, options: { titleCaseNames?: boolean } = {}): HygienizedContact {
  const titleCaseNames = options.titleCaseNames ?? false;
  const companyInput = input.companyRaw ?? input.company ?? "";
  const sanitized = sanitizeCompany(companyInput);
  return {
    email: input.email ? normalizeEmail(input.email) : "",
    firstName: normalizeName(input.firstName ?? "", titleCaseNames),
    lastName: normalizeName(input.lastName ?? "", titleCaseNames),
    phone: input.phone?.trim() || undefined,
    title: input.title?.trim() || undefined,
    company: sanitized.company,
    companyRaw: sanitized.companyRaw,
    companyDomain: input.companyDomain?.trim() ? input.companyDomain.trim().toLowerCase() : undefined,
  };
}

async function upsertCompany(
  workspaceId: string,
  mapped: HygienizedContact,
  db: Db,
) {
  const name = mapped.company;
  if (!name) return null;
  const existing = await db.company.findFirst({ where: { workspaceId, name } });
  if (existing) {
    return db.company.update({
      where: { id: existing.id },
      data: {
        domain: mapped.companyDomain ?? mapped.website ?? existing.domain,
        industry: mapped.industry ?? existing.industry,
      },
    });
  }
  return db.company.create({
    data: {
      workspaceId,
      name,
      domain: mapped.companyDomain ?? mapped.website,
      industry: mapped.industry,
    },
  });
}

export async function persistHygienizedContact(
  input: {
    workspaceId: string;
    mapped: HygienizedContact;
    hygieneStatus: HygienizedRow["hygieneStatus"];
    flags: string[];
    source: IngestSource;
    sourceEvent: SourceEvent;
    createdById?: string | null;
    existing?: ExistingContact | null;
  },
  db: Db = prisma,
) {
  const existing = input.existing ?? null;
  const merged = existing ? mergeMapped(existingToMapped(existing), input.mapped) : input.mapped;
  const suppressed = input.flags.includes("suppressed") || existing?.hygieneStatus === "SUPPRESSED";
  const classified = classifyMapped(merged, {
    suppressedEmails: suppressed && merged.email ? new Set([merged.email]) : new Set(),
  });
  const hygieneStatus = (suppressed ? "SUPPRESSED" : classified.hygieneStatus) as ContactHygieneStatus;
  const flags = suppressed && !classified.flags.includes("suppressed") ? [...classified.flags, "suppressed"] : classified.flags;
  const sourceDetail = mergeSourceDetail(existing?.sourceDetail, input.sourceEvent);
  const company = await upsertCompany(input.workspaceId, merged, db);
  const data = {
    firstName: merged.firstName || existing?.firstName || "Unknown",
    lastName: merged.lastName || existing?.lastName || "Contact",
    email: merged.email || null,
    phone: merged.phone,
    title: merged.title,
    companyId: company?.id,
    companyRaw: merged.companyRaw,
    companyDomain: merged.companyDomain,
    hygieneStatus,
    hygieneFlags: toPrismaJson(flags),
    source: input.source,
    sourceDetail: toPrismaJson(sourceDetail),
  };

  if (existing) {
    return db.contact.update({ where: { id: existing.id }, data });
  }

  return db.contact.create({
    data: {
      workspaceId: input.workspaceId,
      createdById: input.createdById ?? undefined,
      ...data,
    },
  });
}

export async function ingestWebhookContact(
  input: {
    workspaceId: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    title?: string | null;
    company?: string | null;
    companyDomain?: string | null;
    createdById?: string | null;
  },
  db: Db = prisma,
) {
  return ingestContactRecord({ ...input, source: "WEBHOOK" }, db);
}

export async function ingestContactRecord(
  input: {
    workspaceId: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    title?: string | null;
    company?: string | null;
    companyDomain?: string | null;
    source: IngestSource;
    createdById?: string | null;
    titleCaseNames?: boolean;
  },
  db: Db = prisma,
) {
  const mapped = contactFromInput(input, { titleCaseNames: input.titleCaseNames ?? false });
  const context = await loadHygieneContext(input.workspaceId, mapped.email ? [mapped.email] : [], db);
  const classified = classifyMapped(mapped, context);
  const existing = mapped.email ? context.existingByEmail.get(mapped.email) ?? null : null;
  return persistHygienizedContact(
    {
      workspaceId: input.workspaceId,
      mapped,
      hygieneStatus: classified.hygieneStatus,
      flags: classified.flags,
      source: input.source,
      sourceEvent: { source: input.source, at: new Date().toISOString() },
      createdById: input.createdById,
      existing,
    },
    db,
  );
}

export async function markContactsSuppressed(workspaceId: string, email: string, db: Db = prisma) {
  const normalized = normalizeEmail(email);
  if (!normalized || !isValidEmailSyntax(normalized)) return;
  const contacts = await db.contact.findMany({ where: { workspaceId, email: normalized } });
  await Promise.all(
    contacts.map((contact) =>
      db.contact.update({
        where: { id: contact.id },
        data: {
          hygieneStatus: "SUPPRESSED",
          hygieneFlags: toPrismaJson([...new Set([...asFlags(contact.hygieneFlags), "suppressed"])]),
        },
      }),
    ),
  );
}

export { hygienizeRows, summarizeHygiene };
export type { CsvRow, ExistingContact, HygienizedRow };

export type PersistReadyResult = {
  created: number;
  merged: number;
  skipped: number;
  contacts: Array<{ id: string; email: string | null }>;
};

export async function persistReadyRows(
  input: {
    workspaceId: string;
    rows: HygienizedRow[];
    source: IngestSource;
    fileName?: string | null;
    batchId?: string;
    listName?: string | null;
    createdById?: string | null;
    existingByEmail: Map<string, ExistingContact>;
  },
  db: Db = prisma,
): Promise<PersistReadyResult> {
  let created = 0;
  let merged = 0;
  let skipped = 0;
  const contacts: Array<{ id: string; email: string | null }> = [];
  for (const row of input.rows) {
    if (!row.isPrimary || row.hygieneStatus !== "READY") {
      skipped += 1;
      continue;
    }
    const existing = row.mapped.email ? input.existingByEmail.get(row.mapped.email) ?? null : null;
    const contact = await persistHygienizedContact(
      {
        workspaceId: input.workspaceId,
        mapped: row.mapped,
        hygieneStatus: row.hygieneStatus,
        flags: row.flags,
        source: input.source,
        sourceEvent: {
          source: input.source,
          at: new Date().toISOString(),
          fileName: input.fileName ?? undefined,
          batchId: input.batchId,
          rowNumber: row.rowNumber,
          listName: input.listName ?? undefined,
        },
        createdById: input.createdById,
        existing,
      },
      db,
    );
    if (existing) merged += 1;
    else created += 1;
    contacts.push({ id: contact.id, email: contact.email });
    if (contact.email) {
      input.existingByEmail.set(contact.email, {
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
      });
    }
  }
  return { created, merged, skipped, contacts };
}

export function toRowCreateData(workspaceId: string, row: HygienizedRow): Prisma.ContactImportRowCreateWithoutBatchInput {
  return {
    workspace: { connect: { id: workspaceId } },
    rowNumber: row.rowNumber,
    raw: toPrismaJson(row.raw),
    mapped: toPrismaJson(row.mapped),
    issues: toPrismaJson(row.flags),
    isValid: row.isValid,
    hygieneStatus: row.hygieneStatus,
    dedupeKey: row.mapped.email || null,
  };
}
