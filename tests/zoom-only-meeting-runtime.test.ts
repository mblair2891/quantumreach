import fs from "node:fs";
import { describe, expect, it } from "vitest";

const meetingPages = fs.readFileSync("components/dashboard/meeting-pages.tsx", "utf8");
const publicMeet = fs.readFileSync("app/meet/[slug]/page.tsx", "utf8");
const service = fs.readFileSync("lib/meetings/service.ts", "utf8");
const pkg = fs.readFileSync("package.json", "utf8");
const env = fs.readFileSync(".env.example", "utf8");

describe("Zoom-only meeting runtime cutover", () => {
  it("opens protected host start redirects in a new tab without rendering raw Zoom URLs", () => {
    expect(meetingPages).toContain('target="_blank"');
    expect(meetingPages).toContain('rel="noopener noreferrer"');
    expect(meetingPages).toContain('/api/meetings/${meeting.id}/start');
    expect(meetingPages).not.toContain('providerStartUrlEncrypted');
    expect(meetingPages).not.toContain('providerJoinUrl ? <Button href={meeting.providerJoinUrl}');
  });

  it("keeps guest invitations protected and provider-aware before Zoom redirect", () => {
    expect(publicMeet).toContain("Hosted with Zoom");
    expect(publicMeet).toContain("Continue to Zoom");
    expect(publicMeet).toContain("getZoomJoinUrl");
    expect(publicMeet).not.toContain("MeetingClient");
    expect(publicMeet).not.toContain("LiveKitRoom");
    expect(service).toContain("zoom.guest_join_redirected");
  });

  it("forces Zoom for new meetings and blocks creation when Zoom is not connected", () => {
    expect(service).toContain('if (!zoomIntegration) throw new Error("Connect Zoom to create meetings.");');
    expect(service).toContain('const provider = "ZOOM" as MeetingProvider;');
    expect(meetingPages).not.toContain('value="NATIVE_LIVEKIT"');
    expect(meetingPages).toContain("Connect Zoom to create meetings");
  });

  it("removes LiveKit browser/runtime dependencies and env requirements", () => {
    expect(pkg).not.toContain("livekit-client");
    expect(pkg).not.toContain("@livekit/components-react");
    expect(pkg).not.toContain("@livekit/components-styles");
    expect(env).not.toContain("LIVEKIT_URL");
    expect(env).not.toContain("LIVEKIT_API_KEY");
    expect(env).not.toContain("LIVEKIT_API_SECRET");
  });
});
