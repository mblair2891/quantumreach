import { Prisma } from "@prisma/client";

type NormalizedJson = string | number | boolean | null | NormalizedJson[] | { [key: string]: NormalizedJson };

function normalizeJson(value: unknown): NormalizedJson {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalizeJson(item));
  if (typeof value === "object" && value !== null) {
    const jsonLike = value as { toJSON?: () => unknown };
    if (typeof jsonLike.toJSON === "function") return normalizeJson(jsonLike.toJSON());

    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined && typeof entryValue !== "function" && typeof entryValue !== "symbol")
        .map(([key, entryValue]) => [key, normalizeJson(entryValue)])
    );
  }

  return null;
}

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  const normalized = normalizeJson(value);
  return normalized === null ? {} : (normalized as Prisma.InputJsonValue);
}
