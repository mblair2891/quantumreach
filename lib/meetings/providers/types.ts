import type { MeetingProvider } from "@prisma/client";

export type MeetingProviderName = MeetingProvider;
export type ProviderMeetingInput = { workspaceId: string; title: string; description?: string; scheduledAt?: Date; durationMinutes?: number; timezone?: string; waitingRoom?: boolean; recordingPlanned?: boolean; recordingPreference?: "NONE"|"ZOOM_CLOUD"|"LOCAL_UPLOAD"; joinBeforeHost?: boolean; muteOnEntry?: boolean; hostId?: string };
export type ProviderMeetingResult = { providerMeetingId: string; providerHostId?: string; providerAccountId?: string; joinUrl: string; startUrl?: string; status?: string; metadata?: Record<string, unknown> };
export type ProviderJoinDetails = { joinUrl: string; startUrl?: string };
export type ProviderMeetingStatus = { status: string; endedAt?: Date };
export type ProviderRecordingArtifact = { providerArtifactId: string; providerMeetingId: string; recordingType?: string; fileType?: string; mimeType?: string; fileSizeBytes?: bigint; startedAt?: Date; endedAt?: Date; downloadUrl?: string; status?: string };
export type ProviderOAuthTokenResult = { accessToken: string; refreshToken?: string; expiresAt?: Date; scopes?: string[] };

export interface MeetingProviderAdapter {
  provider: MeetingProviderName;
  createMeeting(input: ProviderMeetingInput): Promise<ProviderMeetingResult>;
  updateMeeting(providerMeetingId: string, input: ProviderMeetingInput): Promise<ProviderMeetingResult>;
  cancelMeeting(providerMeetingId: string): Promise<void>;
  getJoinDetails(providerMeetingId: string): Promise<ProviderJoinDetails>;
  refreshMeeting(providerMeetingId: string): Promise<ProviderMeetingStatus>;
  listRecordingArtifacts(providerMeetingId: string): Promise<ProviderRecordingArtifact[]>;
  downloadArtifact(artifact: ProviderRecordingArtifact): Promise<ReadableStream | Buffer>;
  refreshAccessToken(): Promise<ProviderOAuthTokenResult>;
}
