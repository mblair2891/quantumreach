import { describe, expect, it } from "vitest";
import fs from "node:fs";

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const service = fs.readFileSync("lib/meetings/service.ts", "utf8");
const lobby = fs.readFileSync("lib/meetings/lobby.ts", "utf8");
const tokenRoute = fs.readFileSync("app/api/meetings/[id]/token/route.ts", "utf8");
const recordings = fs.readFileSync("lib/meetings/recordings.ts", "utf8");
const ui = fs.readFileSync("components/meetings/meeting-client.tsx", "utf8");
const pages = fs.readFileSync("components/dashboard/meeting-pages.tsx", "utf8");

describe("meeting recording defaults and waiting lobby", () => {
  it("adds safe meeting policy and lobby schema", () => {
    expect(schema).toContain("recordingPlanned Boolean @default(false)");
    expect(schema).toContain("recordingConsentRequired Boolean @default(false)");
    expect(schema).toContain("lobbyEnabled Boolean @default(false)");
    expect(schema).toContain("model MeetingLobbyEntry");
    expect(schema).toContain("enum MeetingLobbyStatus");
  });

  it("saves creation settings and prepares planned recording consent", () => {
    expect(service).toContain("recordingPlanned: Boolean(input.recordingPlanned)");
    expect(service).toContain("recordingConsentRequired: Boolean(input.recordingPlanned)");
    expect(service).toContain("preparePlannedRecordingConsent");
    expect(recordings).toContain("meeting.recording_consent_automatically_prepared");
  });

  it("enforces consent before lobby and admission before token", () => {
    expect(lobby).toContain("assertConsentBeforeLobby");
    expect(lobby).toContain("Only the host or co-host can manage the waiting lobby.");
    expect(lobby).toContain("The host did not admit you to this meeting.");
    expect(tokenRoute).toContain("assertRecordingConsentForToken");
    expect(tokenRoute).toContain("assertLobbyAdmissionForToken");
  });

  it("adds UI controls and waiting lobby experience", () => {
    expect(pages).toContain("Record this meeting");
    expect(pages).toContain("Keep participants in lobby until host admits them");
    expect(ui).toContain("Waiting for the host to admit you.");
    expect(ui).toContain("Admit");
    expect(ui).toContain("Deny");
  });
});
