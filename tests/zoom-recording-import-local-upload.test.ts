import { describe, expect, it } from "vitest";
import { isTranscriptArtifact, MAX_UPLOAD_BYTES, mimeFromZoomFileType, normalizeRecordingMime, recordingObjectKey, safeFileName, validateRecordingFile } from "@/lib/meetings/recording-files";

describe("zoom recording import and local upload helpers", () => {
  it("maps Zoom media and transcript file types safely", () => {
    expect(mimeFromZoomFileType("MP4")).toBe("video/mp4");
    expect(mimeFromZoomFileType("M4A")).toBe("audio/mp4");
    expect(mimeFromZoomFileType("VTT")).toBe("text/vtt");
    expect(isTranscriptArtifact({ fileType: "VTT", recordingType: "audio_transcript", mimeType: "text/vtt" })).toBe(true);
  });

  it.each([
    ["audioMichaelBlair11110210290.m4a", "audio/x-m4a"],
    ["zoom-audio.m4a", "audio/m4a"],
    ["zoom-audio.m4a", "audio/mp4"],
    ["zoom-audio.m4a", ""],
    ["zoom-audio.m4a", "application/octet-stream"],
    ["ZOOM-AUDIO.M4A", " AUDIO/X-M4A "],
  ])("normalizes M4A alias %s / %s to audio/mp4", (name, mime) => {
    expect(normalizeRecordingMime(name, mime)).toBe("audio/mp4");
    expect(validateRecordingFile(name, mime, BigInt(1024))).toBe("audio/mp4");
  });

  it.each([
    ["zoom-video.mp4", "video/mp4", "video/mp4"],
    ["zoom-video.mp4", "", "video/mp4"],
    ["zoom-video.mp4", "application/octet-stream", "video/mp4"],
    ["zoom-audio.mp3", "audio/mpeg", "audio/mpeg"],
    ["zoom-audio.mp3", "", "audio/mpeg"],
    ["zoom-audio.wav", "audio/x-wav", "audio/wav"],
    ["zoom-audio.wav", "audio/wav", "audio/wav"],
    ["zoom-audio.wav", "application/octet-stream", "audio/wav"],
    ["zoom-video.webm", "video/webm", "video/webm"],
    ["zoom-audio.webm", "audio/webm", "audio/webm"],
    ["zoom-video.mov", "video/quicktime", "video/quicktime"],
  ])("normalizes supported recording format %s / %s", (name, mime, normalized) => {
    expect(validateRecordingFile(name, mime, BigInt(1024))).toBe(normalized);
  });

  it.each([
    ["malware.exe", "application/octet-stream"],
    ["zoom-audio.m4a", "video/quicktime"],
    ["zoom-audio.mp3", "video/mp4"],
    ["renamed-audio.exe", "audio/mp4"],
    ["recording", "application/octet-stream"],
  ])("rejects unsupported or mismatched recording input %s / %s", (name, mime) => {
    expect(() => validateRecordingFile(name, mime, BigInt(1024))).toThrow(/Unsupported/);
  });

  it("rejects invalid upload sizes", () => {
    expect(() => validateRecordingFile("recording.mp4", "video/mp4", BigInt(0))).toThrow(/empty/);
    expect(() => validateRecordingFile("recording.mp4", "video/mp4", MAX_UPLOAD_BYTES + BigInt(1))).toThrow(/larger/);
  });

  it("generates server-owned object keys without client path leakage", () => {
    const key = recordingObjectKey("workspace_1", "meeting_1", "recording_1", "local", "C:/Users/me/Zoom/My Call.mp4");
    expect(key).toContain("workspaces/workspace_1/meetings/meeting_1/recordings/recording_1/local/");
    expect(key).toContain("My-Call.mp4");
    expect(key).not.toContain("Users");
    expect(safeFileName("../secret.mp4")).toBe("secret.mp4");
  });
});
