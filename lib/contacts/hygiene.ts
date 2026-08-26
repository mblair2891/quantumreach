export const CONTACT_HYGIENE_STATUSES = ["READY", "NEEDS_REVIEW", "INVALID", "SUPPRESSED"] as const;
export type ContactHygieneStatus = (typeof CONTACT_HYGIENE_STATUSES)[number];

export const HYGIENE_FLAGS = [
  "invalid_email",
  "missing_email",
  "missing_name",
  "missing_required_field",
  "emoji_in_company",
  "domain_mismatch",
  "duplicate_in_upload",
  "duplicate_in_workspace",
  "suppressed",
] as const;
export type HygieneFlag = (typeof HYGIENE_FLAGS)[number];

export type CsvRow = Record<string, string | undefined>;

export type HygienizedContact = {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  title?: string;
  company: string;
  companyRaw?: string;
  companyDomain?: string;
  website?: string;
  industry?: string;
  linkedInUrl?: string;
  location?: string;
  notes?: string;
};

export type ExistingContact = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  title?: string | null;
  companyRaw?: string | null;
  companyDomain?: string | null;
  hygieneStatus?: string | null;
  hygieneFlags?: unknown;
  sourceDetail?: unknown;
};

export type SourceEvent = {
  source: string;
  at: string;
  fileName?: string;
  batchId?: string;
  rowNumber?: number;
  listName?: string;
};

export type HygienizedRow = {
  rowNumber: number;
  raw: CsvRow;
  mapped: HygienizedContact;
  flags: HygieneFlag[];
  issues: HygieneFlag[];
  hygieneStatus: ContactHygieneStatus;
  isPrimary: boolean;
  isValid: boolean;
  mergeIntoRowNumber?: number;
};

export type HygieneContext = {
  existingByEmail?: Map<string, ExistingContact>;
  suppressedEmails?: Set<string>;
  requiredFields?: string[];
  titleCaseNames?: boolean;
};

const EMAIL_RE = /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?\.[a-z]{2,}$/i;
const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const MERGE_TAG_RE = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmailSyntax(email: string) {
  const value = normalizeEmail(email);
  if (!value || value.includes("..")) return false;
  return EMAIL_RE.test(value);
}

export function normalizeName(value: string, titleCase = false) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || !titleCase) return trimmed;
  return trimmed
    .split(" ")
    .map((part) =>
      part
        .split("-")
        .map((segment) =>
          segment
            .split("'")
            .map((piece) => (piece ? piece.charAt(0).toUpperCase() + piece.slice(1).toLowerCase() : piece))
            .join("'"),
        )
        .join("-"),
    )
    .join(" ");
}

export function normalizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export function emailDomain(email: string) {
  const at = normalizeEmail(email).lastIndexOf("@");
  if (at < 0) return "";
  return normalizeDomain(normalizeEmail(email).slice(at + 1));
}

export function sanitizeCompany(value: string) {
  const companyRaw = value.trim();
  EMOJI_RE.lastIndex = 0;
  const hadEmoji = EMOJI_RE.test(companyRaw);
  EMOJI_RE.lastIndex = 0;
  const company = companyRaw.replace(EMOJI_RE, "").replace(/\s+/g, " ").trim();
  return { company, companyRaw: companyRaw || undefined, hadEmoji };
}

function pick(row: CsvRow, ...keys: string[]) {
  const entries = Object.entries(row);
  for (const key of keys) {
    const needle = key.replace(/[\s_]/g, "").toLowerCase();
    const match = entries.find(([header]) => header.replace(/[\s_]/g, "").toLowerCase() === needle);
    const value = match?.[1] ?? row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];
    if (value?.trim()) return value.trim();
  }
  return undefined;
}

export function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length);
  if (!lines.length) return [];
  const headerCells = parseCsvLine(lines[0]);
  const normalizedHeaders = headerCells.map((cell) => cell.replace(/^"|"$/g, "").trim());
  const hasEmailHeader = normalizedHeaders.some((header) => header.replace(/[\s_]/g, "").toLowerCase() === "email");
  if (!hasEmailHeader) {
    return lines.map((line) => {
      const cells = parseCsvLine(line).map((cell) => cell.replace(/^"|"$/g, ""));
      return { email: cells[0], firstName: cells[1], lastName: cells[2], company: cells[3], companyDomain: cells[4] };
    });
  }
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line).map((cell) => cell.replace(/^"|"$/g, ""));
    const row: CsvRow = {};
    normalizedHeaders.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });
}

export function mapContactRow(row: CsvRow, options: { titleCaseNames?: boolean } = {}): HygienizedContact {
  const titleCaseNames = options.titleCaseNames ?? true;
  const website = pick(row, "website", "domain", "company website");
  const companyInput = pick(row, "company", "account", "company name") ?? "";
  const { company, companyRaw, hadEmoji } = sanitizeCompany(companyInput);
  void hadEmoji;
  const explicitDomain = pick(row, "companyDomain", "company_domain", "company domain");
  const companyDomain = explicitDomain ? normalizeDomain(explicitDomain) : website ? normalizeDomain(website) : undefined;
  const email = normalizeEmail(pick(row, "email") ?? "");
  return {
    email,
    firstName: normalizeName(pick(row, "first name", "firstName", "first_name", "firstname") ?? "", titleCaseNames),
    lastName: normalizeName(pick(row, "last name", "lastName", "last_name", "lastname") ?? "", titleCaseNames),
    phone: pick(row, "phone", "mobile"),
    title: pick(row, "title", "job title"),
    company,
    companyRaw,
    companyDomain: companyDomain || undefined,
    website,
    industry: pick(row, "industry"),
    linkedInUrl: pick(row, "linkedin", "linkedin url", "linkedinurl"),
    location: pick(row, "location", "city"),
    notes: pick(row, "notes"),
  };
}

export function requiredFieldsFromSettings(settings: unknown): string[] {
  const object = settings && typeof settings === "object" && !Array.isArray(settings) ? (settings as Record<string, unknown>) : {};
  const configured = Array.isArray(object.contactRequiredFields)
    ? object.contactRequiredFields.filter((field): field is string => typeof field === "string" && field.trim().length > 0)
    : [];
  const fields = configured.map((field) => field.trim());
  if (!fields.includes("email")) fields.unshift("email");
  return fields;
}

export function requiredFieldsFromTemplate(...templates: Array<string | null | undefined>) {
  const text = templates.filter(Boolean).join("\n");
  const fields = new Set<string>();
  MERGE_TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MERGE_TAG_RE.exec(text))) {
    const tag = match[1].toLowerCase();
    if (tag === "firstname") fields.add("firstName");
    else if (tag === "lastname") fields.add("lastName");
    else if (tag === "email") fields.add("email");
    else if (tag === "company") fields.add("company");
  }
  return [...fields];
}

function fieldValue(mapped: HygienizedContact, field: string) {
  if (field === "email") return mapped.email;
  if (field === "firstName") return mapped.firstName;
  if (field === "lastName") return mapped.lastName;
  if (field === "company") return mapped.company;
  if (field === "phone") return mapped.phone ?? "";
  if (field === "title") return mapped.title ?? "";
  if (field === "companyDomain") return mapped.companyDomain ?? "";
  return "";
}

export function classifyMapped(mapped: HygienizedContact, context: HygieneContext = {}): { flags: HygieneFlag[]; hygieneStatus: ContactHygieneStatus } {
  const flags: HygieneFlag[] = [];
  const requiredFields = context.requiredFields?.length ? context.requiredFields : ["email"];
  const suppressed = Boolean(mapped.email && context.suppressedEmails?.has(mapped.email));

  if (!mapped.email) flags.push("missing_email");
  else if (!isValidEmailSyntax(mapped.email)) flags.push("invalid_email");

  if (!mapped.firstName && !mapped.lastName) flags.push("missing_name");

  for (const field of requiredFields) {
    if (!fieldValue(mapped, field)) {
      if (field === "email" && (flags.includes("missing_email") || flags.includes("invalid_email"))) continue;
      if (field === "firstName" || field === "lastName") {
        if (flags.includes("missing_name")) continue;
      }
      if (!flags.includes("missing_required_field")) flags.push("missing_required_field");
    }
  }

  if (mapped.companyRaw) {
    const sanitized = sanitizeCompany(mapped.companyRaw);
    if (sanitized.hadEmoji) flags.push("emoji_in_company");
  }

  if (mapped.companyDomain && mapped.email && isValidEmailSyntax(mapped.email)) {
    const mailDomain = emailDomain(mapped.email);
    if (mailDomain && mapped.companyDomain !== mailDomain) flags.push("domain_mismatch");
  }

  if (suppressed) flags.push("suppressed");

  let hygieneStatus: ContactHygieneStatus = "READY";
  if (suppressed) hygieneStatus = "SUPPRESSED";
  else if (flags.includes("invalid_email") || flags.includes("missing_email")) hygieneStatus = "INVALID";
  else if (
    flags.includes("domain_mismatch") ||
    flags.includes("emoji_in_company") ||
    flags.includes("missing_name") ||
    flags.includes("missing_required_field")
  ) {
    hygieneStatus = "NEEDS_REVIEW";
  }

  return { flags, hygieneStatus };
}

export function mergeMapped(base: HygienizedContact, incoming: HygienizedContact): HygienizedContact {
  return {
    email: base.email || incoming.email,
    firstName: base.firstName || incoming.firstName,
    lastName: base.lastName || incoming.lastName,
    phone: base.phone || incoming.phone,
    title: base.title || incoming.title,
    company: base.company || incoming.company,
    companyRaw: base.companyRaw || incoming.companyRaw,
    companyDomain: base.companyDomain || incoming.companyDomain,
    website: base.website || incoming.website,
    industry: base.industry || incoming.industry,
    linkedInUrl: base.linkedInUrl || incoming.linkedInUrl,
    location: base.location || incoming.location,
    notes: [base.notes, incoming.notes].filter(Boolean).join("\n") || undefined,
  };
}

export function mergeSourceDetail(existing: unknown, event: SourceEvent) {
  const previous = existing && typeof existing === "object" && !Array.isArray(existing) ? (existing as { sources?: unknown }) : {};
  const sources = Array.isArray(previous.sources) ? previous.sources : [];
  return { ...previous, sources: [...sources, event] };
}

export function hygienizeRows(rows: CsvRow[], context: HygieneContext = {}): HygienizedRow[] {
  const titleCaseNames = context.titleCaseNames ?? true;
  const prepared: HygienizedRow[] = rows.map((raw, index) => {
    const mapped = mapContactRow(raw, { titleCaseNames });
    const classified = classifyMapped(mapped, context);
    return {
      rowNumber: index + 1,
      raw,
      mapped,
      flags: classified.flags,
      issues: classified.flags,
      hygieneStatus: classified.hygieneStatus,
      isPrimary: true,
      isValid: classified.hygieneStatus === "READY",
    };
  });

  const primaryByEmail = new Map<string, HygienizedRow>();
  for (const row of prepared) {
    if (!row.mapped.email || !isValidEmailSyntax(row.mapped.email)) continue;
    const existing = primaryByEmail.get(row.mapped.email);
    if (!existing) {
      primaryByEmail.set(row.mapped.email, row);
      continue;
    }
    existing.mapped = mergeMapped(existing.mapped, row.mapped);
    const reclassified = classifyMapped(existing.mapped, context);
    existing.flags = reclassified.flags;
    existing.issues = reclassified.flags;
    existing.hygieneStatus = reclassified.hygieneStatus;
    existing.isValid = reclassified.hygieneStatus === "READY";
    row.isPrimary = false;
    row.mergeIntoRowNumber = existing.rowNumber;
    if (!row.flags.includes("duplicate_in_upload")) row.flags = [...row.flags, "duplicate_in_upload"];
    row.issues = row.flags;
    row.isValid = false;
  }

  for (const row of prepared) {
    if (!row.isPrimary || !row.mapped.email) continue;
    if (context.existingByEmail?.has(row.mapped.email)) {
      if (!row.flags.includes("duplicate_in_workspace")) row.flags = [...row.flags, "duplicate_in_workspace"];
      row.issues = row.flags;
    }
    row.isValid = row.isPrimary && row.hygieneStatus === "READY";
  }

  return prepared;
}

export function summarizeHygiene(rows: HygienizedRow[]) {
  const ready = rows.filter((row) => row.isPrimary && row.hygieneStatus === "READY").length;
  const needsReview = rows.filter((row) => row.isPrimary && row.hygieneStatus === "NEEDS_REVIEW").length;
  const invalid = rows.filter((row) => row.isPrimary && row.hygieneStatus === "INVALID").length;
  const suppressed = rows.filter((row) => row.isPrimary && row.hygieneStatus === "SUPPRESSED").length;
  const merged = rows.filter((row) => !row.isPrimary).length;
  return {
    rowCount: rows.length,
    readyCount: ready,
    needsReviewCount: needsReview,
    invalidCount: invalid,
    suppressedCount: suppressed,
    mergedCount: merged,
    validCount: ready,
    flaggedCount: rows.length - ready,
  };
}

export function isCampaignEligible(contact: {
  status?: string | null;
  hygieneStatus?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: { name?: string | null } | null;
  companyRaw?: string | null;
}, requiredFields: string[] = []) {
  if (contact.status === "ARCHIVED") return false;
  if ((contact.hygieneStatus ?? "READY") !== "READY") return false;
  if (!contact.email || !isValidEmailSyntax(contact.email)) return false;
  for (const field of requiredFields) {
    if (field === "firstName" && !contact.firstName?.trim()) return false;
    if (field === "lastName" && !contact.lastName?.trim()) return false;
    if (field === "company" && !contact.company?.name?.trim() && !contact.companyRaw?.trim()) return false;
    if (field === "email" && !contact.email?.trim()) return false;
  }
  return true;
}

export function hygieneSkipReason(contact: { hygieneStatus?: string | null; email?: string | null }) {
  const status = contact.hygieneStatus ?? "READY";
  if (status === "SUPPRESSED") return "SUPPRESSED";
  if (status === "INVALID") return "INVALID";
  if (status === "NEEDS_REVIEW") return "NEEDS_REVIEW";
  if (!contact.email || !isValidEmailSyntax(contact.email)) return "INVALID";
  return null;
}

export function rejectsCsv(rows: HygienizedRow[]) {
  const rejected = rows.filter((row) => !row.isValid);
  const header = "rowNumber,email,firstName,lastName,company,companyDomain,status,flags";
  const escape = (value: string) => {
    if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
    return value;
  };
  const body = rejected.map((row) =>
    [
      String(row.rowNumber),
      row.mapped.email,
      row.mapped.firstName,
      row.mapped.lastName,
      row.mapped.company,
      row.mapped.companyDomain ?? "",
      row.isPrimary ? row.hygieneStatus : "MERGED",
      row.flags.join("|"),
    ]
      .map(escape)
      .join(","),
  );
  return [header, ...body].join("\n");
}
