import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSafeDatabaseDiagnostic } from "@/lib/admin/database-diagnostic";

const currentUser = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({ currentUser }));

describe("database provider diagnostic", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    currentUser.mockReset();
    process.env = { ...originalEnv, ADMIN_EMAILS: "ops@example.com" };
  });

  it("rejects unauthorized users before returning database metadata", async () => {
    currentUser.mockResolvedValue({ emailAddresses: [{ emailAddress: "viewer@example.com" }] });
    const { GET } = await import("@/app/api/admin/database-diagnostic/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Operator access is required." });
  });

  it("lets an authorized operator see only safe parsed fields", async () => {
    const result = getSafeDatabaseDiagnostic({
      DATABASE_URL: "postgresql://secret_user:secret_password@db.example.com:6543/quantumreach?sslmode=require&token=secret",
      DIRECT_DATABASE_URL: "postgresql://direct_user:direct_password@direct.example.com:5432/quantumreach",
    });

    expect(result).toEqual({
      databaseUrlPresent: true,
      directDatabaseUrlPresent: true,
      host: "db.example.com",
      port: "6543",
      database: "quantumreach",
    });
    expect(Object.keys(result).sort()).toEqual(["database", "databaseUrlPresent", "directDatabaseUrlPresent", "host", "port"].sort());
  });

  it("never returns username, password, query parameters, or full connection strings", () => {
    const fullConnectionString = "postgresql://secret_user:secret_password@db.example.com:6543/quantumreach?sslmode=require&token=secret";
    const serialized = JSON.stringify(getSafeDatabaseDiagnostic({ DATABASE_URL: fullConnectionString }));

    expect(serialized).not.toContain("secret_user");
    expect(serialized).not.toContain("secret_password");
    expect(serialized).not.toContain("sslmode");
    expect(serialized).not.toContain("token=secret");
    expect(serialized).not.toContain(fullConnectionString);
  });

  it("reports a missing DIRECT_DATABASE_URL safely", () => {
    const result = getSafeDatabaseDiagnostic({
      DATABASE_URL: "postgresql://secret_user:secret_password@db.example.com/quantumreach",
      DIRECT_DATABASE_URL: "",
    });

    expect(result.directDatabaseUrlPresent).toBe(false);
    expect(JSON.stringify(result)).not.toContain("secret_password");
  });

  it("returns a safe route error when DATABASE_URL parsing fails", async () => {
    currentUser.mockResolvedValue({ emailAddresses: [{ emailAddress: "ops@example.com" }] });
    process.env.DATABASE_URL = "not a postgres url with spaces";
    const { GET } = await import("@/app/api/admin/database-diagnostic/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "DATABASE_URL could not be parsed safely." });
    expect(JSON.stringify(body)).not.toContain("not a postgres url with spaces");
  });
});
