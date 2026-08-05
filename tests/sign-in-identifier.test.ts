import { describe, expect, it } from "vitest";
import { isEmailIdentifier, normalizeSignInIdentifier } from "@/lib/auth/identifier";
import { readFileSync } from "node:fs";

describe("sign-in identifier", () => {
  it("classifies email vs username", () => {
    expect(isEmailIdentifier("Founder@Example.com")).toBe(true);
    expect(isEmailIdentifier("founder_ops")).toBe(false);
    expect(normalizeSignInIdentifier("Founder@Example.com")).toEqual({
      kind: "email",
      value: "founder@example.com",
    });
    expect(normalizeSignInIdentifier("Founder_Ops")).toEqual({
      kind: "username",
      value: "founder_ops",
    });
  });

  it("uses a single identifier field and username-capable client", () => {
    const form = readFileSync("components/auth/sign-in-form.tsx", "utf8");
    const client = readFileSync("lib/auth/client.ts", "utf8");
    const auth = readFileSync("lib/auth/better-auth.ts", "utf8");
    expect(form).toContain('name="identifier"');
    expect(form).toContain("signIn.username");
    expect(form).toContain("signIn.email");
    expect(form).toContain("/app");
    expect(client).toContain("usernameClient");
    expect(auth).toContain("username(");
  });
});
