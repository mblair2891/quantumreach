/** Shared auth migration constants (Better Auth cutover + pay-first setup). */

/** Account setup token lifetime after paid order (Phase 0 decision). */
export const ACCOUNT_SETUP_TOKEN_TTL_HOURS = 48;

/** Env override for public email/password self-registration. Platform admin setting comes later. */
export function isPublicSignUpEnabled(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): boolean {
  return env.BETTER_AUTH_PUBLIC_SIGNUP_ENABLED === "true";
}
