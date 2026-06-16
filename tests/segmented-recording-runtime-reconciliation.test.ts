import fs from "node:fs";
import { describe, expect, it } from "vitest";

const recordings = fs.readFileSync("lib/meetings/recordings.ts", "utf8");
const egress = fs.readFileSync("lib/meetings/egress.ts", "utf8");
const webhook = fs.readFileSync("app/api/webhooks/livekit/route.ts", "utf8");
const ui = fs.readFileSync("components/meetings/meeting-client.tsx", "utf8");

describe("segmented recording runtime reconciliation repair", () => {
  it("starts every new LiveKit egress through a physical segment", () => {
    expect(recordings).toContain("const segment=await createSegment");
    expect(recordings).toContain("providerEgressId:result.egressId");
    expect(recordings).toContain("status:\"STARTING\",startedById:user.id");
    expect(egress).toContain("segmentNumber: number");
    expect(egress).toContain("buildMeetingRecordingSegmentKey");
    expect(egress).toContain("segments/${segmentNumber}/recording.mp4");
  });

  it("uses structured provider parsing instead of JSON string status inference", () => {
    expect(egress).toContain("export function parseLiveKitEgress");
    expect(egress).toContain("fileResults || info.file_results");
    expect(egress).toContain("info.startedAt ?? info.started_at");
    expect(egress).toContain("info.endedAt ?? info.ended_at");
    expect(recordings).toContain("parseLiveKitEgress(provider)");
    expect(recordings).not.toContain("mapLiveKitStatus(JSON.stringify(provider))");
  });

  it("webhooks locate segments and do not queue transcription on pause finalization", () => {
    expect(webhook).toContain("parseLiveKitEgress(info)");
    expect(webhook).toContain("markWebhookRecordingStarted(id,eventKey,parsed.startedAt)");
    expect(webhook).toContain("markWebhookRecordingFailed");
    expect(recordings).toContain("findUnique({where:{providerEgressId},include:{recording:true}})");
    expect(recordings).toContain("latest.status===\"PAUSING\"");
    expect(recordings).toContain("status:\"PAUSED\"");
  });

  it("prevents stop and refresh races from restoring recording after final intent", () => {
    expect(recordings).toContain("[\"PAUSING\",\"STOPPING\",\"PROCESSING\",\"AVAILABLE\"].includes(latest.status)");
    expect(recordings).toContain("[\"STOPPING\",\"PROCESSING\"].includes(recording.status)");
    expect(recordings).toContain("return prisma.meetingRecording.update({where:{id:recordingId},data:{status:\"PROCESSING\"}}");
  });

  it("keeps duration/timer data segment based and hides storage/provider details", () => {
    expect(recordings).toContain("durationFromSegments");
    expect(recordings).toContain("activeSegmentStartedAt");
    expect(ui).toContain("baseRecordedSeconds + (activeStartedAt");
    expect(recordings).toContain("segmentNumber:s.segmentNumber");
    expect(recordings).not.toContain("providerEgressId:s.providerEgressId");
    expect(recordings).not.toContain("storageKey:s.storageKey");
  });

  it("supports legacy conversion and deterministic final transcription queueing", () => {
    expect(recordings).toContain("ensureLegacySegment");
    expect(recordings).toContain("!r.providerEgressId");
    expect(recordings).toContain("storageKey:r.storageKey");
    expect(recordings).toContain("meetingTranscriptionJob.upsert");
    expect(recordings).toContain("transcription:${r.id}");
    expect(recordings).toContain("latest.transcriptionJobs.some");
  });
});
