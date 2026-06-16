import { describe, expect, it } from "vitest";
import fs from "node:fs";

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const recordings = fs.readFileSync("lib/meetings/recordings.ts", "utf8");
const egress = fs.readFileSync("lib/meetings/egress.ts", "utf8");
const transcription = fs.readFileSync("lib/meetings/transcription.ts", "utf8");
const webhook = fs.readFileSync("app/api/webhooks/livekit/route.ts", "utf8");
const meetingUi = fs.readFileSync("components/meetings/meeting-client.tsx", "utf8");
const detailUi = fs.readFileSync("components/dashboard/meeting-pages.tsx", "utf8");

describe("Phase 9B meeting recording consent and handoff", () => {
  it("adds workspace-scoped recording, consent, event, and transcription job models", () => {
    for (const fragment of ["model MeetingRecording", "model MeetingRecordingConsent", "model MeetingRecordingEvent", "model MeetingTranscriptionJob", "enum MeetingRecordingStatus", "enum RecordingConsentStatus", "enum MeetingTranscriptionStatus"]) expect(schema).toContain(fragment);
    expect(schema).toContain("@@unique([recordingId, livekitIdentity])");
    expect(schema).toContain("@@index([workspaceId, meetingRoomId, status])");
    expect(schema).toContain("providerEgressId          String?                    @unique");
  });

  it("gates start behind explicit per-recording consent and host authorization", () => {
    expect(recordings).toContain("Only the host or co-host can manage recording.");
    expect(recordings).toContain("Recording cannot start until every required participant has consented.");
    expect(recordings).toContain("recordingId_livekitIdentity");
    expect(recordings).toContain("A participant declined recording consent.");
    expect(recordings).toContain("CONSENT_REVOKED");
  });

  it("uses server-generated LiveKit Egress and private R2 recording keys", () => {
    expect(egress).toContain("StartRoomCompositeEgress");
    expect(egress).toContain("video:{roomRecord:true}");
    expect(egress).not.toContain("video:{roomAdmin:true}");
    expect(egress).toContain("now+300");
    expect(egress).toContain("LIVEKIT_API_SECRET");
    expect(egress).toContain("MEETING_RECORDINGS_R2_BUCKET");
    expect(egress).toContain("workspaces/${encodeURIComponent(workspaceId)}/meetings/${encodeURIComponent(meetingId)}/recordings/${encodeURIComponent(recordingId)}/recording.mp4");
    expect(egress).not.toContain("NEXT_PUBLIC_MEETING_RECORDINGS_R2_SECRET");
  });


  it("uses HTTP LiveKit endpoints for Egress while preserving browser WebSocket URLs", () => {
    expect(egress).toContain('export function livekitHttpUrl()');
    expect(egress).toContain('value.startsWith("wss://")');
    expect(egress).toContain('`https://${value.slice("wss://".length)}`');
    expect(egress).toContain('value.startsWith("ws://")');
    expect(egress).toContain('`http://${value.slice("ws://".length)}`');
    expect(egress).toContain('livekitHttpUrl()}${path}');
    expect(egress).toContain('/twirp/livekit.Egress/${method}');
    const livekit = fs.readFileSync("lib/meetings/livekit.ts", "utf8");
    expect(livekit).toContain('return required("LIVEKIT_URL");');
    expect(livekit).not.toContain("livekitHttpUrl");
  });

  it("parses Twirp errors safely and does not expose credentials or JWTs to client code", () => {
    expect(egress).toContain("const rawText = await response.text()");
    expect(egress).toContain("JSON.parse(rawText)");
    expect(egress).toContain("parsed.msg || parsed.message || parsed.code");
    expect(egress).toContain("safeTwirpMessage");
    expect(egress).toContain("Recording provider request failed.");
    expect(egress).toContain("egressId || result.egress_id");
    expect(meetingUi).not.toContain("MEETING_RECORDINGS_R2_SECRET_ACCESS_KEY");
    expect(meetingUi).not.toContain("LIVEKIT_API_SECRET");
    expect(meetingUi).not.toContain("Authorization");
    expect(detailUi).not.toContain("MEETING_RECORDINGS_R2_SECRET_ACCESS_KEY");
    expect(detailUi).not.toContain("LIVEKIT_API_SECRET");
  });

  it("keeps the start route JSON shape and provider failures on service-error statuses", () => {
    const route = fs.readFileSync("app/api/meetings/[id]/recordings/[recordingId]/start/route.ts", "utf8");
    expect(route).toContain("ok: true, recording: { id: recording.id, status: recording.status }");
    expect(route).toContain("ok: false, error: message");
    expect(route).toContain("return 503");
  });

  it("verifies LiveKit webhooks and queues transcription idempotently", () => {
    expect(webhook).toContain("LIVEKIT_API_SECRET");
    expect(webhook).toContain("createHmac");
    expect(recordings).toContain("meetingTranscriptionJob.upsert");
    expect(recordings).toContain("providerEgressId:result.egressId");
    expect(recordings).toContain('status:"STARTING"');
    expect(recordings).toContain("if(r.status===\"AVAILABLE\") return r");
  });

  it("keeps transcription server-only, bounded, review-required, and audit-safe", () => {
    expect(transcription).toContain("MAX_SYNC_TRANSCRIPTION_BYTES");
    expect(transcription).toContain("gpt-4o-mini-transcribe");
    expect(transcription).toContain("REVIEW_REQUIRED");
    expect(transcription).toContain("Approved transcripts cannot be edited");
    expect(transcription).not.toContain("metadata:toPrismaJson({transcript");
  });

  it("hands approved transcript into CallSession without duplicate diagnostic creation", () => {
    expect(transcription).toContain("transcriptSource:`meeting_recording:${r.id}`");
    expect(transcription).toContain("status:\"TRANSCRIPT_READY\"");
    expect(transcription).not.toContain("createDiagnosticFromCallSession");
    expect(transcription).toContain("already has transcript text");
  });

  it("renders consent prompts, recording indicator, status card, protected download, and transcript review", () => {
    expect(meetingUi).toContain("Recording consent requested");
    expect(meetingUi).toContain("I consent to recording");
    expect(meetingUi).toContain("Recording is active");
    expect(detailUi).toContain("Recordings and transcripts");
    expect(detailUi).toContain("Protected download");
    expect(detailUi).toContain("Review transcript");
  });
});
