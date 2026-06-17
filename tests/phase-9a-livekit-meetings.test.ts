import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("legacy native runtime retirement", () => {
  it("removes active LiveKit client and webhook routes while preserving historical docs", () => {
    expect(fs.existsSync("components/meetings/meeting-client.tsx")).toBe(false);
    expect(fs.existsSync("app/api/meetings/[id]/token/route.ts")).toBe(false);
    expect(fs.existsSync("app/api/webhooks/livekit/route.ts")).toBe(false);
    expect(fs.existsSync("docs/phase-9a-livekit-meetings.md")).toBe(true);
    expect(fs.existsSync("docs/phase-9b-recording-transcript-handoff.md")).toBe(true);
  });
});
