export type SafeDatabaseDiagnostic = {
  databaseUrlPresent: boolean;
  directDatabaseUrlPresent: boolean;
  host: string | null;
  port: string | null;
  database: string | null;
};

export function getSafeDatabaseDiagnostic(env: { DATABASE_URL?: string; DIRECT_DATABASE_URL?: string } = process.env as { DATABASE_URL?: string; DIRECT_DATABASE_URL?: string }): SafeDatabaseDiagnostic {
  const databaseUrl = env.DATABASE_URL;
  const databaseUrlPresent = Boolean(databaseUrl);

  const diagnostic: SafeDatabaseDiagnostic = {
    databaseUrlPresent,
    directDatabaseUrlPresent: Boolean(env.DIRECT_DATABASE_URL),
    host: null,
    port: null,
    database: null,
  };

  if (!databaseUrl) return diagnostic;

  try {
    const parsed = new URL(databaseUrl);
    diagnostic.host = parsed.hostname || null;
    diagnostic.port = parsed.port || null;
    diagnostic.database = parsed.pathname ? decodeURIComponent(parsed.pathname.replace(/^\//, "")) || null : null;
    return diagnostic;
  } catch {
    throw new Error("DATABASE_URL could not be parsed safely.");
  }
}
