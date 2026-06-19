import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Zoom lifecycle timestamp synchronization", () => {
  it("normalizes Zoom second and millisecond event timestamps", () => {
    const lifecycle = readFileSync("lib/meetings/zoom-lifecycle.ts", "utf8");
    expect(lifecycle).toContain("eventTs > 10_000_000_000 ? eventTs : eventTs * 1000");
  });

  it("handles started and ended events idempotently with provider precedence", () => {
    const route = readFileSync("app/api/webhooks/zoom/route.ts", "utf8");
    const lifecycle = readFileSync("lib/meetings/zoom-lifecycle.ts", "utf8");
    expect(route).toContain("meeting.started");
    expect(route).toContain("meeting.ended");
    expect(lifecycle).toContain("meeting.started");
    expect(lifecycle).toContain("meeting.ended");
    expect(lifecycle).toContain("meeting.startedAt ??");
    expect(lifecycle).toContain("meeting.endedAt ?? occurredAt");
    expect(lifecycle).toContain("zoom-started:");
    expect(lifecycle).toContain("zoom-ended:");
  });
});
