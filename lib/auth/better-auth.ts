import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { prisma } from "@/lib/db/prisma";
import { isPublicSignUpEnabled } from "@/lib/auth/constants";

/**
 * Static fallback base URL for non-request contexts (scripts, seed, build).
 * Request-time resolution uses allowedHosts so Vercel Preview hosts work
 * without updating env vars for every deployment URL.
 */
function resolveFallbackBaseUrl() {
  const candidates = [
    process.env.BETTER_AUTH_URL,
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

function hostFromUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProtocol).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Allowlist of hosts that may act as Better Auth base URL / trusted origin.
 * Includes:
 * - localhost for local dev
 * - *.vercel.app for all Vercel Preview (and production *.vercel.app) hosts
 * - known production domain(s)
 * - any host from configured env base URLs
 */
function resolveAllowedHosts(): string[] {
  const hosts = new Set<string>([
    "localhost",
    "localhost:*",
    "127.0.0.1",
    "127.0.0.1:*",
    "*.vercel.app",
    "quantumreach.app",
    "www.quantumreach.app",
  ]);

  for (const value of [
    process.env.BETTER_AUTH_URL,
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ]) {
    const host = hostFromUrl(value);
    if (host) hosts.add(host);
  }

  return [...hosts];
}

function resolveSecret() {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (secret) return secret;
  // Local/typecheck/build without secrets: never use this in production deploys.
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET is required in production.");
  }
  return "quantum-reach-dev-better-auth-secret-not-for-production";
}

/**
 * Better Auth instance (Prisma adapter, email + password).
 * Clerk remains the active app identity until a later phase rewires requireUserProfile.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: resolveSecret(),
  // Dynamic base URL: validate Host / x-forwarded-host against allowedHosts
  // so Preview deployments at unique *.vercel.app URLs work without env churn.
  // allowedHosts are also auto-merged into trustedOrigins (https + localhost http).
  baseURL: {
    allowedHosts: resolveAllowedHosts(),
    fallback: resolveFallbackBaseUrl(),
  },
  emailAndPassword: {
    enabled: true,
    // Phase 0: public self-service sign-up disabled unless env override is set.
    // Later: platform admin setting can drive the same flag.
    disableSignUp: !isPublicSignUpEnabled(),
  },
  // Explicit wildcard so Origin checks accept any Vercel Preview host.
  // Does not disable origin checks globally — only allowlisted patterns pass.
  trustedOrigins: [
    "https://*.vercel.app",
    resolveFallbackBaseUrl(),
  ],
  plugins: [
    nextCookies(),
    // Enables username on the auth user + /sign-in/username (email/password remains available).
    username({
      minUsernameLength: 3,
      maxUsernameLength: 32,
    }),
  ],
});

export type BetterAuthSession = typeof auth.$Infer.Session;
export type BetterAuthUser = BetterAuthSession["user"];
