import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("meeting invitation management repair", () => {
  it("uses server-signed persistent invitation credentials with no plaintext stored authority", async () => {
    vi.stubEnv("MEETING_INVITATION_SECRET", "test-secret-with-enough-entropy");
    const { signMeetingInvitationCredential, verifyMeetingInvitationCredential } = await import("../lib/meetings/invitations");
    const token = signMeetingInvitationCredential({ invitationId: "inv_1", meetingId: "meet_1", tokenVersion: 2, expiresAt: new Date(Date.now() + 60000) });
    expect(verifyMeetingInvitationCredential(token)).toMatchObject({ typ: "meeting_invitation", invitationId: "inv_1", meetingId: "meet_1", version: 2 });
    expect(verifyMeetingInvitationCredential(`${token}x`)).toBeNull();
  });

  it("builds copy links from NEXT_PUBLIC_APP_URL and the invite query parameter", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://quantumreach.app/");
    const { buildMeetingInvitationUrl } = await import("../lib/meetings/invitations");
    expect(buildMeetingInvitationUrl("slug", "signed.credential")).toBe("https://quantumreach.app/meet/slug?invite=signed.credential");
  });

  it("defaults maximum expiry to scheduledAt plus 24 hours", async () => {
    const { maxInvitationExpiry } = await import("../lib/meetings/invitations");
    expect(maxInvitationExpiry(new Date("2026-06-20T14:00:00.000Z")).toISOString()).toBe("2026-06-21T14:00:00.000Z");
  });
});
