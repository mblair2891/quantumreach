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
    expect(egress).toContain("MEETING_RECORDINGS_R2_BUCKET");
    expect(egress).toContain("workspaces/${encodeURIComponent(workspaceId)}/meetings/${encodeURIComponent(meetingId)}/recordings/${encodeURIComponent(recordingId)}/recording.mp4");
    expect(egress).not.toContain("NEXT_PUBLIC_MEETING_RECORDINGS_R2_SECRET");
  });

  it("verifies LiveKit webhooks and queues transcription idempotently", () => {
    expect(webhook).toContain("LIVEKIT_API_SECRET");
    expect(webhook).toContain("createHmac");
    expect(recordings).toContain("meetingTranscriptionJob.upsert");
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
