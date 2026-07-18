import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const migrationsDirectory = join(process.cwd(), "prisma", "migrations");

// A comment-only migration is normally a release blocker: migrations are the
// production record of Prisma schema changes. The sole exception is retained
// here to preserve the checksum of an already-applied historical migration.
// Adding a new exception requires an explicit, reviewed operational reason.
const historicalCommentOnlyMigrations = new Map([
  [
    "20260718120000_managed_email_domain_infrastructure",
    "Applied historical defect; its missing DDL is recovered by 20260718000000_operationalize_sending.",
  ],
]);

const stripSqlComments = (sql) => sql
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/--[^\n]*/g, "")
  .trim();

const entries = await readdir(migrationsDirectory, { withFileTypes: true });
const failures = [];

for (const entry of entries.filter((candidate) => candidate.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const migrationPath = join(migrationsDirectory, entry.name, "migration.sql");
  let sql;

  try {
    sql = await readFile(migrationPath, "utf8");
  } catch (error) {
    failures.push(`${entry.name}: missing migration.sql (${error instanceof Error ? error.message : String(error)})`);
    continue;
  }

  if (stripSqlComments(sql)) continue;

  const historicalReason = historicalCommentOnlyMigrations.get(entry.name);
  if (historicalReason) {
    console.warn(`Allowed historical comment-only migration: ${entry.name}. ${historicalReason}`);
    continue;
  }

  failures.push(`${entry.name}: migration.sql contains only comments or whitespace. Add executable DDL, or add a narrowly documented historical exception to scripts/check-migration-sql.mjs.`);
}

if (failures.length) {
  console.error("Suspicious Prisma migration SQL detected:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Prisma migration SQL integrity check passed.");
