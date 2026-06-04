export type CrmSummaryField = {
  label: string;
  value: string;
  href?: string;
  tone?: "status";
};

export type CrmContextSummary = {
  recordType: string;
  fields: CrmSummaryField[];
};

type CrmObject = Record<string, unknown>;

const supportedRecordTypes = new Set(["Opportunity", "Company", "Contact", "Lead"]);

function asObject(value: unknown): CrmObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as CrmObject) : null;
}

function displayRecordType(relatedType?: string | null) {
  if (!relatedType) return "Not linked";
  return supportedRecordTypes.has(relatedType) ? relatedType : relatedType.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function present(value: unknown, fallback = "—") {
  if (value == null || value === "") return fallback;
  return String(value);
}

function linkedName(value: unknown) {
  const object = asObject(value);
  if (!object) return "Not linked";
  const fullName = [object.firstName, object.lastName].filter(Boolean).join(" ").trim();
  return present(object.name ?? fullName, "Not linked");
}

function linkedHref(module: "companies" | "contacts", value: unknown) {
  const object = asObject(value);
  return typeof object?.id === "string" ? `/dashboard/${module}/${object.id}` : undefined;
}

function formatCurrency(value: unknown) {
  if (value == null || value === "") return "—";
  const normalized = typeof value === "object" && value !== null && "toString" in value ? value.toString() : value;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return present(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: amount % 1 === 0 ? 0 : 2 }).format(amount);
}

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return present(value);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function contactName(context: CrmObject) {
  return [context.firstName, context.lastName].filter(Boolean).join(" ").trim();
}

export function summarizeCrmContext(relatedType?: string | null, crmContext?: unknown): CrmContextSummary {
  const recordType = displayRecordType(relatedType);
  const context = asObject(crmContext);

  if (!context) {
    return {
      recordType,
      fields: [
        { label: "Name", value: "Not linked" },
        { label: "Status", value: "Not linked", tone: "status" }
      ]
    };
  }

  if (relatedType === "Opportunity") {
    return {
      recordType,
      fields: [
        { label: "Name", value: present(context.name) },
        { label: "Amount", value: formatCurrency(context.amount) },
        { label: "Status", value: present(context.status), tone: "status" },
        { label: "Close date", value: formatDate(context.closeDate) },
        { label: "Company", value: linkedName(context.company), href: linkedHref("companies", context.company) },
        { label: "Contact", value: linkedName(context.contact), href: linkedHref("contacts", context.contact) }
      ]
    };
  }

  if (relatedType === "Company") {
    return {
      recordType,
      fields: [
        { label: "Name", value: present(context.name) },
        { label: "Domain", value: present(context.domain) },
        { label: "Industry", value: present(context.industry) },
        { label: "Status", value: present(context.status), tone: "status" }
      ]
    };
  }

  if (relatedType === "Contact") {
    return {
      recordType,
      fields: [
        { label: "Name", value: present(contactName(context)) },
        { label: "Email", value: present(context.email) },
        { label: "Title", value: present(context.title) },
        { label: "Status", value: present(context.status), tone: "status" },
        { label: "Company", value: linkedName(context.company), href: linkedHref("companies", context.company) }
      ]
    };
  }

  if (relatedType === "Lead") {
    return {
      recordType,
      fields: [
        { label: "Name", value: present(context.name) },
        { label: "Email", value: present(context.email) },
        { label: "Source", value: present(context.source) },
        { label: "Score", value: present(context.score) },
        { label: "Status", value: present(context.status), tone: "status" },
        { label: "Company", value: linkedName(context.company), href: linkedHref("companies", context.company) },
        { label: "Contact", value: linkedName(context.contact), href: linkedHref("contacts", context.contact) }
      ]
    };
  }

  return {
    recordType,
    fields: Object.entries(context).filter(([key]) => key !== "id").map(([key, value]) => ({ label: key.replace(/([a-z])([A-Z])/g, "$1 $2"), value: present(value) }))
  };
}
