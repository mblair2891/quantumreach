import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { prisma } from "@/lib/db/prisma";
import { isPublicSignUpEnabled } from "@/lib/auth/constants";

function resolveBaseUrl() {
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
  baseURL: resolveBaseUrl(),
  emailAndPassword: {
    enabled: true,
    // Phase 0: public self-service sign-up disabled unless env override is set.
    // Later: platform admin setting can drive the same flag.
    disableSignUp: !isPublicSignUpEnabled(),
  },
  trustedOrigins: [resolveBaseUrl()],
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
