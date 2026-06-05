export type ReportRisk = {
  label: string;
  severity?: string;
  description?: string;
};

export type ReportRiskAssumptionSections = {
  risks: ReportRisk[];
  assumptions: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = cleanText(record[key]);
    if (value.length > 0) return value;
  }
  return "";
}

export function formatSeverityLabel(value: unknown) {
  const severity = cleanText(value);
  if (!severity) return "Unspecified";
  return severity
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeRiskItem(item: unknown): ReportRisk | null {
  if (typeof item === "string") {
    const label = item.trim();
    return label ? { label, severity: "Unspecified" } : null;
  }

  if (!isRecord(item)) return null;

  const label = firstText(item, ["label", "title", "name", "risk"]);
  const description = firstText(item, ["description", "detail", "impact", "rationale", "evidence"]);

  if (!label && !description) return null;

  return {
    label: label || "Risk identified",
    severity: formatSeverityLabel(item.severity),
    description: description || undefined
  };
}

function normalizeAssumptionItem(item: unknown): string | null {
  if (typeof item === "string") {
    const text = item.trim();
    return text || null;
  }

  if (!isRecord(item)) return null;

  const text = firstText(item, ["assumption", "description", "label", "title", "value", "detail"]);
  return text || null;
}

export function normalizeRiskAssumptionSections(value: unknown): ReportRiskAssumptionSections {
  const riskSource = isRecord(value) ? value.risks : value;
  const assumptionSource = isRecord(value) ? value.assumptions : [];

  const risks = Array.isArray(riskSource) ? riskSource.map(normalizeRiskItem).filter((risk): risk is ReportRisk => Boolean(risk)) : [];
  const assumptions = Array.isArray(assumptionSource) ? assumptionSource.map(normalizeAssumptionItem).filter((assumption): assumption is string => Boolean(assumption)) : [];

  return { risks, assumptions };
}
