import { headers } from "next/headers";
import { auth, type BetterAuthSession, type BetterAuthUser } from "@/lib/auth/better-auth";

export type AuthSessionResult = {
  session: BetterAuthSession["session"];
  user: BetterAuthUser;
};

/**
 * Read the Better Auth session from the current request cookies/headers.
 * Returns null when unauthenticated. Does not redirect (Clerk still owns app redirects).
 */
export async function getBetterAuthSession(): Promise<AuthSessionResult | null> {
  // Next.js 14: headers() is synchronous. Pass the Headers instance to Better Auth.
  const session = await auth.api.getSession({ headers: headers() });
  if (!session?.user?.id || !session.session?.id) return null;
  return { session: session.session, user: session.user };
}

/** Convenience accessor for the Better Auth user only. */
export async function getBetterAuthUser(): Promise<BetterAuthUser | null> {
  const result = await getBetterAuthSession();
  return result?.user ?? null;
}

/**
 * Session helper for future requireUserProfile replacement.
 * Throws a stable error when no session exists (callers may map to redirects later).
 */
export async function requireBetterAuthSession(): Promise<AuthSessionResult> {
  const result = await getBetterAuthSession();
  if (!result) throw new Error("BETTER_AUTH_SESSION_REQUIRED");
  return result;
}
