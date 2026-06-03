import { describe, expect, it } from "vitest";
import { checkInMemoryRateLimit } from "@/lib/rate-limit";

describe("in-memory rate limit helper", () => {
  it("blocks calls after the configured limit", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    expect(checkInMemoryRateLimit(key, 1, 60_000).allowed).toBe(true);
    expect(checkInMemoryRateLimit(key, 1, 60_000).allowed).toBe(false);
  });
});
