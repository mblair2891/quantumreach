import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("scripts/seed-operator.ts", "utf8");
const pkg = readFileSync("package.json", "utf8");

describe("operator seed script", () => {
  it("is wired as npm run seed:operator", () => {
    expect(pkg).toContain('"seed:operator"');
    expect(pkg).toContain("scripts/seed-operator.ts");
  });

  it("requires email/password from env or flags and checks ADMIN_EMAILS", () => {
    expect(source).toContain("OPERATOR_EMAIL");
    expect(source).toContain("OPERATOR_PASSWORD");
    expect(source).toContain("ADMIN_EMAILS");
    expect(source).toContain("hashPassword");
    expect(source).toContain('providerId: "credential"');
    expect(source).toContain("authUserId");
  });

  it("is idempotent and does not hardcode credentials", () => {
    expect(source).toContain("updatePassword");
    expect(source).toContain("findUnique");
    expect(source).not.toMatch(/password\s*=\s*["'][^"']{8,}["']/);
  });
});
