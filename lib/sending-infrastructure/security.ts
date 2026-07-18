const SECRET_KEYS = [/password/i, /secret/i, /api[_-]?key/i, /token/i, /refresh/i, /smtp/i, /imap/i, /authorization/i];
export function redactSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEYS.some((r) => r.test(k)) ? "[REDACTED]" : redactSecrets(v)])) as T;
  }
  if (typeof value === "string" && /AKIA|BEGIN PRIVATE KEY|xox[baprs]-|sk_live_|sk_test_/i.test(value)) return "[REDACTED]" as T;
  return value;
}
export function safeErrorMessage(error: unknown) { return String(error instanceof Error ? error.message : error).replace(/(password|secret|api[_-]?key|token)=([^\s&]+)/gi, "$1=[REDACTED]"); }
