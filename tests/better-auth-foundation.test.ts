import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ACCOUNT_SETUP_TOKEN_TTL_HOURS, isPublicSignUpEnabled } from "@/lib/auth/constants";

const source = (path: string) => readFileSync(path, "utf8");

describe("Better Auth foundation and identity cutover", () => {
  it("keeps public self-service sign-up disabled unless explicitly enabled", () => {
    expect(isPublicSignUpEnabled({})).toBe(false);
    expect(isPublicSignUpEnabled({ BETTER_AUTH_PUBLIC_SIGNUP_ENABLED: "true" })).toBe(true);
    expect(isPublicSignUpEnabled({ BETTER_AUTH_PUBLIC_SIGNUP_ENABLED: "false" })).toBe(false);
    expect(ACCOUNT_SETUP_TOKEN_TTL_HOURS).toBe(48);
  });

  it("wires the Prisma adapter, email/password, and Next.js cookie plugin", () => {
    const config = source("lib/auth/better-auth.ts");
    expect(config).toContain('from "better-auth"');
    expect(config).toContain('from "better-auth/adapters/prisma"');
    expect(config).toContain("prismaAdapter");
    expect(config).toContain("emailAndPassword");
    expect(config).toContain("disableSignUp");
    expect(config).toContain("nextCookies");
    expect(config).not.toContain("@clerk");
  });

  it("supports dynamic Vercel Preview hosts without disabling origin checks", () => {
    const config = source("lib/auth/better-auth.ts");
    expect(config).toContain("allowedHosts");
    expect(config).toContain('"*.vercel.app"');
    expect(config).toContain("https://*.vercel.app");
    expect(config).toContain("trustedOrigins");
    expect(config).toContain("fallback");
    // Still uses allowlist model — not an open CORS disable
    expect(config).not.toContain("disableOriginCheck");
    expect(config).not.toContain('trustedOrigins: ["*"]');
  });

  it("exposes the catch-all auth API route handler", () => {
    const route = source("app/api/auth/[...all]/route.ts");
    expect(route).toContain("toNextJsHandler");
    expect(route).toContain("lib/auth/better-auth");
  });

  it("uses Better Auth sessions in requireUserProfile without Clerk", () => {
    const session = source("lib/auth/session.ts");
    const rbac = source("lib/auth/rbac.ts");
    const middleware = source("middleware.ts");
    expect(session).toContain("getBetterAuthSession");
    expect(rbac).toContain("getBetterAuthSession");
    expect(rbac).toContain("authUserId");
    expect(rbac).not.toContain("@clerk");
    expect(middleware).toContain("getSessionCookie");
    expect(middleware).toContain("/platform");
    expect(middleware).toContain("/portal");
    expect(middleware).not.toContain("clerk");
  });

  it("maps Better Auth models and UserProfile.authUserId in Prisma schema", () => {
    const schema = source("prisma/schema.prisma");
    expect(schema).toContain('@@map("user")');
    expect(schema).toContain("authUserId");
    expect(schema).toContain("model UserProfile");
  });

  it("serves custom sign-in and gated sign-up pages", () => {
    expect(source("app/sign-in/page.tsx")).toContain("SignInForm");
    expect(source("app/sign-up/page.tsx")).toContain("isPublicSignUpEnabled");
    expect(source("components/auth/account-menu.tsx")).toContain("signOut");
  });
});
