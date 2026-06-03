type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function checkInMemoryRateLimit(key: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (existing.count >= limit) return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}
