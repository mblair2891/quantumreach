import { describe, expect, it } from "vitest";
import { isTranscriptArtifact, MAX_UPLOAD_BYTES, mimeFromZoomFileType, recordingObjectKey, safeFileName, validateRecordingFile } from "@/lib/meetings/recording-files";

describe("zoom recording import and local upload helpers", () => {
  it("maps Zoom media and transcript file types safely", () => {
    expect(mimeFromZoomFileType("MP4")).toBe("video/mp4");
    expect(mimeFromZoomFileType("M4A")).toBe("audio/mp4");
    expect(mimeFromZoomFileType("VTT")).toBe("text/vtt");
    expect(isTranscriptArtifact({ fileType: "VTT", recordingType: "audio_transcript", mimeType: "text/vtt" })).toBe(true);
  });

  it("accepts supported local recording formats and rejects mismatches", () => {
    expect(() => validateRecordingFile("zoom-audio.m4a", "audio/mp4", BigInt(1024))).not.toThrow();
    expect(() => validateRecordingFile("zoom-video.mp4", "video/mp4", BigInt(1024))).not.toThrow();
    expect(() => validateRecordingFile("notes.txt", "video/mp4", BigInt(1024))).toThrow(/Unsupported/);
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
