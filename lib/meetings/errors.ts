const publicMessages = new Set([
  "Meeting not found.",
  "This meeting is no longer joinable.",
  "A valid invitation is required.",
  "This invitation is not valid.",
  "This invitation has been revoked.",
  "This invitation has expired.",
  "You are not authorized to end this meeting.",
  "LiveKit configuration is unavailable."
]);

export function safeMeetingError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return publicMessages.has(message) ? message : fallback;
}
