/** Shared helpers for email-or-username sign-in. */

/** Treat values containing "@" as email identifiers; everything else as username. */
export function isEmailIdentifier(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Practical check: Better Auth email sign-in requires an email-shaped value.
  return trimmed.includes("@");
}

export function normalizeSignInIdentifier(value: string): { kind: "email" | "username"; value: string } {
  const trimmed = value.trim();
  if (isEmailIdentifier(trimmed)) {
    return { kind: "email", value: trimmed.toLowerCase() };
  }
  return { kind: "username", value: trimmed.toLowerCase() };
}
