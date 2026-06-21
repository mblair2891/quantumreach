import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const db = vi.hoisted(() => ({
  providerWebhookEvent: { upsert: vi.fn(), update: vi.fn() },
  meetingRoom: { findFirst: vi.fn(), update: vi.fn() },
  meetingEvent: { upsert: vi.fn() },
  meetingProviderArtifact: { upsert: vi.fn() }
}));
const auditMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/audit/service", () => ({ audit: auditMock }));

function sign(rawBody: string, timestamp: string) {
  return `v0=${createHmac("sha256", process.env.ZOOM_WEBHOOK_SECRET_TOKEN!).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
}

function signedRequest(rawBody: string, timestamp = String(Math.floor(Date.now() / 1000)), signature = sign(rawBody, timestamp)) {
  return new Request("https://quantumreach.test/api/webhooks/zoom", {
    method: "POST",
    body: rawBody,
    headers: {
      "x-zm-request-timestamp": timestamp,
      "x-zm-signature": signature
    }
  });
}

function body(event: string, providerMeetingId = "987654321", extraObject: Record<string, unknown> = {}) {
  return JSON.stringify({
    event,
    event_ts: Math.floor(Date.now() / 1000),
    payload: { object: { id: providerMeetingId, ...extraObject } }
  });
}

async function routePost() {
  const route = await import("../app/api/webhooks/zoom/route");
  return route.POST;
}

beforeEach(() => {
  process.env.ZOOM_WEBHOOK_SECRET_TOKEN = "zoom-webhook-secret";
  vi.useRealTimers();
  vi.clearAllMocks();
  db.providerWebhookEvent.upsert.mockResolvedValue({ id: "event_1", processedAt: null });
  db.providerWebhookEvent.update.mockResolvedValue({});
  db.meetingRoom.findFirst.mockResolvedValue({ id: "meeting_1", workspaceId: "workspace_1", providerMeetingId: "987654321", startedAt: null, endedAt: null, MeetingRecording: [] });
  db.meetingRoom.update.mockResolvedValue({ id: "meeting_1" });
  db.meetingEvent.upsert.mockResolvedValue({});
  db.meetingProviderArtifact.upsert.mockResolvedValue({ id: "artifact_1", providerArtifactId: "file_1", fileType: "MP4" });
});

describe("Zoom webhook timestamp signature verification", () => {
  it("accepts a current Unix-seconds timestamp with a correct signature", async () => {
    const { verifyZoomWebhookSignature } = await import("../lib/meetings/providers/zoom");
    const raw = body("meeting.started");
    const timestamp = String(Math.floor(Date.now() / 1000));
    expect(verifyZoomWebhookSignature(raw, timestamp, sign(raw, timestamp))).toBe(true);
  });

  it("accepts a Unix-seconds timestamp approximately four minutes old", async () => {
    const { verifyZoomWebhookSignature } = await import("../lib/meetings/providers/zoom");
    const raw = body("meeting.started");
    const timestamp = String(Math.floor((Date.now() - 4 * 60 * 1000) / 1000));
    expect(verifyZoomWebhookSignature(raw, timestamp, sign(raw, timestamp))).toBe(true);
  });

  it("rejects stale, future, millisecond, malformed, incorrect, and missing signatures", async () => {
    const { verifyZoomWebhookSignature } = await import("../lib/meetings/providers/zoom");
    const raw = body("meeting.started");
    const stale = String(Math.floor((Date.now() - 5 * 60 * 1000 - 2_000) / 1000));
    const future = String(Math.floor((Date.now() + 5 * 60 * 1000 + 2_000) / 1000));
    const millis = String(Date.now());
    const current = String(Math.floor(Date.now() / 1000));

    expect(verifyZoomWebhookSignature(raw, stale, sign(raw, stale))).toBe(false);
    expect(verifyZoomWebhookSignature(raw, future, sign(raw, future))).toBe(false);
    expect(verifyZoomWebhookSignature(raw, millis, sign(raw, millis))).toBe(false);
    expect(verifyZoomWebhookSignature(raw, current, "v0=not-hex")).toBe(false);
    expect(verifyZoomWebhookSignature(raw, current, sign(raw, current).replace(/.$/, "0"))).toBe(false);
    expect(verifyZoomWebhookSignature(raw, null, sign(raw, current))).toBe(false);
    expect(verifyZoomWebhookSignature(raw, current, null)).toBe(false);
    expect(verifyZoomWebhookSignature(raw, "not-a-number", "v0=bad")).toBe(false);
  });
});

describe("Zoom webhook route lifecycle handling after verification", () => {
  it("routes meeting.started to lifecycle handling", async () => {
    const POST = await routePost();
    const res = await POST(signedRequest(body("meeting.started", "987654321", { start_time: "2026-06-21T12:00:00Z" })));

    expect(res.status).toBe(200);
    expect(db.meetingRoom.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "LIVE", providerStatus: "in_progress" }) }));
    expect(db.meetingEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ type: "ROOM_OPENED" }) }));
  });

  it("routes meeting.ended to lifecycle handling", async () => {
    const POST = await routePost();
    const res = await POST(signedRequest(body("meeting.ended", "987654321", { end_time: "2026-06-21T12:05:00Z" })));

    expect(res.status).toBe(200);
    expect(db.meetingRoom.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ENDED", providerStatus: "ended" }) }));
    expect(db.meetingEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ type: "ROOM_ENDED" }) }));
  });

  it("keeps duplicate events idempotent", async () => {
    db.providerWebhookEvent.upsert.mockResolvedValueOnce({ id: "event_1", processedAt: new Date() });
    const POST = await routePost();
    const res = await POST(signedRequest(body("meeting.started")));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, duplicate: true });
    expect(db.meetingRoom.update).not.toHaveBeenCalled();
  });

  it("keeps recording webhook handling intact", async () => {
    const raw = body("recording.completed", "987654321", { recording_files: [{ id: "file_1", file_type: "MP4", recording_type: "shared_screen_with_speaker_view", file_size: 1234 }] });
    const POST = await routePost();
    const res = await POST(signedRequest(raw));

    expect(res.status).toBe(200);
    expect(db.meetingProviderArtifact.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ providerArtifactId: "file_1", mimeType: "video/mp4" }) }));
  });

  it("keeps URL validation behavior intact without requiring signature headers", async () => {
    const POST = await routePost();
    const res = await POST(new Request("https://quantumreach.test/api/webhooks/zoom", { method: "POST", body: JSON.stringify({ event: "endpoint.url_validation", payload: { plainToken: "plain-token" } }) }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.plainToken).toBe("plain-token");
    expect(json.encryptedToken).toMatch(/^[a-f0-9]{64}$/);
  });
});
