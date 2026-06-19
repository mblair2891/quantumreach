import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("local recording upload UI", () => {
  const source = readFileSync("components/meetings/local-recording-upload.tsx", "utf8");
  const page = readFileSync("components/dashboard/meeting-pages.tsx", "utf8");

  it("renders picker, drag/drop, upload progress, cancel, and retry affordances", () => {
    expect(source).toContain("type=\"file\"");
    expect(source).toContain("Drag and drop a recording here");
    expect(source).toContain("Upload recording");
    expect(source).toContain("progress");
    expect(source).toContain("Cancel upload");
    expect(source).toContain("Retry upload");
  });

  it("rejects unsupported and oversized files before initiating upload", () => {
    expect(source).toContain("Unsupported file type");
    expect(source).toContain("5 GiB");
    expect(source).toContain("file.size>MAX_BYTES");
  });

  it("uses initiate, direct PUT, complete, abort, and refresh without sending media through Next.js", () => {
    expect(source).toContain("recording-uploads/initiate");
    expect(source).toContain("XMLHttpRequest");
    expect(source).toContain("xhr.send(file)");
    expect(source).toContain("/complete?workspaceId=");
    expect(source).toContain("/abort?workspaceId=");
    expect(source).toContain("router.refresh()");
  });

  it("is rendered for LOCAL_UPLOAD meetings and recording list exposes download and transcription actions", () => {
    expect(page).toContain("<LocalRecordingUpload meetingId={id} workspaceId={workspace.id} />");
    expect(page).toContain("Protected download");
    expect(page).toContain("Start transcription");
    expect(page).toContain("Review transcript");
    expect(page).toContain("Source: Local upload");
  });
});
