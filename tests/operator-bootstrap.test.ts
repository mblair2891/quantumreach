import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  isOperatorBootstrapEnvironment,
  isValidBootstrapUsername,
} from "@/lib/auth/operator-bootstrap";

const source = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("operator bootstrap environment gate", () => {
  it.each([
    [{ VERCEL_ENV: "preview", NODE_ENV: "production" }, true],
    [{ NODE_ENV: "development" }, true],
    [{ VERCEL_ENV: "production", NODE_ENV: "development" }, false],
    [{ VERCEL_ENV: "production", NODE_ENV: "production" }, false],
    [{ NODE_ENV: "production" }, false],
    [{ VERCEL_ENV: "development", NODE_ENV: "test" }, false],
  ] as const)("gates %o → %s", (environment, allowed) => {
    expect(isOperatorBootstrapEnvironment(environment)).toBe(allowed);
  });
});

describe("operator bootstrap username validation", () => {
  it("accepts valid handles and rejects invalid ones", () => {
    expect(isValidBootstrapUsername("founder")).toBe(true);
    expect(isValidBootstrapUsername("op_01")).toBe(true);
    expect(isValidBootstrapUsername("ab")).toBe(false);
    expect(isValidBootstrapUsername("Has-Dash")).toBe(false);
    expect(isValidBootstrapUsername("UPPER")).toBe(false);
  });
});

describe("operator bootstrap route and service contracts", () => {
  it("exposes /setup/operator with fail-closed production behavior", () => {
    const page = source("app/setup/operator/page.tsx");
    const actions = source("app/setup/operator/actions.ts");
    const service = source("lib/auth/operator-bootstrap.ts");
    const form = source("components/auth/operator-bootstrap-form.tsx");

    expect(page).toContain("isOperatorBootstrapEnvironment");
    expect(page).toContain("notFound()");
    expect(page).toContain("OperatorBootstrapForm");
    expect(page).toContain("ADMIN_EMAILS");

    expect(actions).toContain("assertOperatorBootstrapEnvironment");
    expect(actions).toContain("bootstrapOperator");
    expect(actions).toContain("signInEmail");
    expect(actions).toContain('redirect("/platform")');

    expect(service).toContain("BOOTSTRAP_SECRET");
    expect(service).toContain("hashPassword");
    expect(service).toContain('providerId: "credential"');
    expect(service).toContain("userProfile");
    expect(service).toContain("ADMIN_EMAILS");
    expect(service).toContain("timingSafeEqual");

    expect(form).toContain('name="email"');
    expect(form).toContain('name="username"');
    expect(form).toContain('name="password"');
    expect(form).toContain('name="confirmPassword"');
    expect(form).toContain("bootstrapSecret");
  });

  it("is not public self-service signup and keeps seed:operator", () => {
    const page = source("app/setup/operator/page.tsx");
    const pkg = source("package.json");
    const constants = source("lib/auth/constants.ts");

    expect(page).toContain("not public self-service");
    expect(pkg).toContain('"seed:operator"');
    expect(constants).toContain("isPublicSignUpEnabled");
  });

  it("documents browser Preview bootstrap steps", () => {
    const doc = source("docs/operator-bootstrap-preview.md");
    expect(doc).toContain("/setup/operator");
    expect(doc).toContain("ADMIN_EMAILS");
    expect(doc).toContain("BOOTSTRAP_SECRET");
    expect(doc).toContain("Preview");
    expect(doc).not.toMatch(/password\s*=\s*["'][^"']{8,}["']/);
  });
});
