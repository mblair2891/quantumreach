import fs from "node:fs";
import { describe, expect, it } from "vitest";

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const recordings = fs.readFileSync("lib/meetings/recordings.ts", "utf8");
const egress = fs.readFileSync("lib/meetings/egress.ts", "utf8");
const ui = fs.readFileSync("components/meetings/meeting-client.tsx", "utf8");
const transcription = fs.readFileSync("lib/meetings/transcription.ts", "utf8");
const webhook = fs.readFileSync("app/api/webhooks/livekit/route.ts", "utf8");

describe("segmented recording controls", () => {
  it("adds logical pause/resume and physical segment models", () => {
    expect(schema).toContain("PAUSING");
    expect(schema).toContain("PAUSED");
    expect(schema).toContain("RESUMING");
    expect(schema).toContain("model MeetingRecordingSegment");
    expect(schema).toContain("@@unique([recordingId, segmentNumber])");
  });

  it("selects active recordings before completed history", () => {
    expect(recordings).toContain('"RECORDING","STARTING","PAUSING","PAUSED","RESUMING"');
    expect(recordings).toContain("selectRoomRecording");
    expect(recordings).toContain("activeRecording");
    expect(recordings).toContain("latestCompletedRecording");
  });

  it("uses unique segment storage keys and server-started egress", () => {
    expect(egress).toContain("segments/${segmentNumber}/recording.mp4");
    expect(recordings).toContain("startSegment(workspaceId,meetingId,recordingId,meeting.roomName,1");
    expect(recordings).toContain("providerEgressId:result.egressId");
  });

  it("implements pause, resume, stop and webhook segment reconciliation", () => {
    expect(recordings).toContain("export async function pauseRecording");
    expect(recordings).toContain("export async function resumeRecording");
    expect(recordings).toContain("status:\"PAUSING\"");
    expect(recordings).toContain("status:\"PAUSED\"");
    expect(webhook).toContain("markWebhookRecordingStarted");
    expect(recordings).toContain("queueFinalTranscription");
  });

  it("keeps host controls visible and shows timer/pause/resume actions", () => {
    expect(ui).toContain("Recording controls");
    expect(ui).toContain("recordingTimer");
    expect(ui).toContain("Pause recording");
    expect(ui).toContain("Resume recording");
    expect(ui).toContain("Stop recording");
    expect(ui).toContain("Recording paused");
  });

  it("transcribes available segments in order into one transcript", () => {
    expect(transcription).toContain("segments:{orderBy:{segmentNumber:\"asc\"}}");
    expect(transcription).toContain("for (const segment of segments)");
    expect(transcription).toContain("texts.join");
    expect(transcription).toContain("segmentCount:segments.length");
  });
});
