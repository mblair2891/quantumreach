import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { MeetingEventType, MeetingParticipantRole, MeetingProvider } from "@prisma/client";
import { notFound } from "next/navigation";
import { audit } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { toPrismaJson } from "@/lib/db/json";
import { getOptionalUserProfile, requireWorkspaceAccess } from "@/lib/auth/rbac";
import { buildMeetingInvitationUrl, maxInvitationExpiry, signMeetingInvitationCredential, verifyMeetingInvitationCredential } from "@/lib/meetings/invitations";
import { preparePlannedRecordingConsent } from "@/lib/meetings/recordings";
import { encryptSecret, decryptSecret } from "@/lib/security/encryption";
import { getConnectedZoomIntegration, listZoomUsers, ZoomMeetingAdapter } from "@/lib/meetings/providers/zoom";

type MeetingInput = {
  title: string;
  recordingPlanned?: boolean;
  recordingConsentRequired?: boolean;
  recordingPreference?: "NONE" | "ZOOM_CLOUD" | "LOCAL_UPLOAD";
  lobbyEnabled?: boolean;
  description?: string;
  scheduledAt?: string;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  opportunityId?: string;
  callSessionId?: string;
  provider?: MeetingProvider | string;
  providerHostId?: string;
  durationMinutes?: number;
};

type JoinAuthorizationInput = {
  meetingId: string;
  invitationToken?: string;
  invitationCredential?: string;
  displayName?: string;
};

type InvitationInput = { displayName?: string; email?: string; role?: string; expiresAt?: string };

function clean(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function safeDisplayName(value: string | undefined, fallback: string) {
  return (clean(value) ?? fallback).replace(/[<>{}\r\n]/g, "").slice(0, 80) || fallback;
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function participantIdentity(meetingId: string, authorityId: string) {
  return `qr_${createHash("sha256").update(`${meetingId}:${authorityId}`).digest("hex").slice(0, 32)}`;
}

async function assertWorkspaceLink(model: "lead" | "contact" | "company" | "opportunity" | "callSession", workspaceId: string, id?: string) {
  if (!id) return;
  const exists =
    model === "lead" ? await prisma.lead.count({ where: { id, workspaceId } }) :
    model === "contact" ? await prisma.contact.count({ where: { id, workspaceId } }) :
    model === "company" ? await prisma.company.count({ where: { id, workspaceId } }) :
    model === "opportunity" ? await prisma.opportunity.count({ where: { id, workspaceId } }) :
    await prisma.callSession.count({ where: { id, workspaceId } });
  if (!exists) throw new Error("A selected linked record is not available in this workspace.");
}

async function assertAvailableCallSession(workspaceId: string, id?: string, meetingId?: string) {
  if (!id) return;
  const exists = await prisma.callSession.count({
    where: {
      id,
      workspaceId,
      OR: [{ meetingRoom: null }, ...(meetingId ? [{ meetingRoom: { id: meetingId } }] : [])]
    }
  });
  if (!exists) throw new Error("The selected call session is already linked or unavailable.");
}

export async function getMeetingFormOptions(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId);
  const [leads, contacts, companies, opportunities, callSessions, zoomIntegration, zoomHosts] = await Promise.all([
    prisma.lead.findMany({ where: { workspaceId, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.contact.findMany({ where: { workspaceId, status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.company.findMany({ where: { workspaceId, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.opportunity.findMany({ where: { workspaceId, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.callSession.findMany({ where: { workspaceId, meetingRoom: null }, select: { id: true, provider: true, callDate: true }, orderBy: { updatedAt: "desc" }, take: 100 }),
    getConnectedZoomIntegration(workspaceId),
    listZoomUsers(workspaceId).catch(() => [])
  ]);
  return { leads, contacts, companies, opportunities, callSessions, zoomConnected: Boolean(zoomIntegration), zoomHosts };
}

export async function listMeetings(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId);
  return prisma.meetingRoom.findMany({
    where: { workspaceId },
    include: {
      host: true,
      lead: true,
      contact: true,
      company: true,
      opportunity: true,
      _count: { select: { participants: true, invitations: true } }
    },
    orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }]
  });
}

export async function getMeetingDetail(workspaceId: string, id: string) {
  await requireWorkspaceAccess(workspaceId);
  const meeting = await prisma.meetingRoom.findFirst({
    where: { id, workspaceId },
    include: {
      host: true,
      lead: true,
      contact: true,
      company: true,
      opportunity: true,
      callSession: true,
      participants: { orderBy: { updatedAt: "desc" } },
      invitations: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { occurredAt: "desc" }, take: 20, include: { participant: true } },
      providerArtifacts: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!meeting) notFound();
  return meeting;
}

export async function createMeeting(workspaceId: string, input: MeetingInput) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const title = clean(input.title);
  if (!title) throw new Error("Meeting title is required.");
  const leadId = clean(input.leadId);
  const contactId = clean(input.contactId);
  const companyId = clean(input.companyId);
  const opportunityId = clean(input.opportunityId);
  const callSessionId = clean(input.callSessionId);
  const scheduledAt = clean(input.scheduledAt);
  const zoomIntegration = await getConnectedZoomIntegration(workspaceId);
  if (!zoomIntegration) throw new Error("Connect Zoom to create meetings.");
  const provider = "ZOOM" as MeetingProvider;
  await Promise.all([
    assertWorkspaceLink("lead", workspaceId, leadId),
    assertWorkspaceLink("contact", workspaceId, contactId),
    assertWorkspaceLink("company", workspaceId, companyId),
    assertWorkspaceLink("opportunity", workspaceId, opportunityId),
    assertAvailableCallSession(workspaceId, callSessionId)
  ]);
  let providerResult: Awaited<ReturnType<ZoomMeetingAdapter["createMeeting"]>> | undefined;
  if (provider === "ZOOM") {
    if (!zoomIntegration) throw new Error("Connect Zoom before creating Zoom-backed meetings.");
    providerResult = await new ZoomMeetingAdapter(zoomIntegration).createMeeting({ workspaceId, title: title.slice(0,160), description: clean(input.description)?.slice(0,2000), scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined, waitingRoom: Boolean(input.lobbyEnabled), recordingPlanned: Boolean(input.recordingPlanned), recordingPreference: input.recordingPreference || (input.recordingPlanned ? "ZOOM_CLOUD" : "NONE"), hostId: clean(input.providerHostId), durationMinutes: input.durationMinutes || 60 });
  }
  const roomEntropy = randomBytes(18).toString("hex");
  const meeting = await prisma.meetingRoom.create({
    data: {
      workspaceId,
      hostId: user.id,
      title: title.slice(0, 160),
      description: clean(input.description)?.slice(0, 2000),
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      leadId,
      contactId,
      companyId,
      opportunityId,
      callSessionId,
      slug: randomBytes(18).toString("base64url"),
      roomName: `quantum-reach-${roomEntropy}`,
      recordingPlanned: (input.recordingPreference || (input.recordingPlanned ? "ZOOM_CLOUD" : "NONE")) !== "NONE",
      recordingPreference: input.recordingPreference || (input.recordingPlanned ? "ZOOM_CLOUD" : "NONE"),
      recordingConsentRequired: (input.recordingPreference || (input.recordingPlanned ? "ZOOM_CLOUD" : "NONE")) !== "NONE",
      lobbyEnabled: Boolean(input.lobbyEnabled),
      lobbyPolicyUpdatedAt: input.lobbyEnabled ? new Date() : undefined,
      provider,
      providerMeetingId: providerResult?.providerMeetingId,
      providerHostId: providerResult?.providerHostId || clean(input.providerHostId),
      providerAccountId: providerResult?.providerAccountId,
      providerJoinUrl: providerResult?.joinUrl,
      providerStartUrlEncrypted: providerResult?.startUrl ? encryptSecret(providerResult.startUrl) : undefined,
      providerStatus: providerResult?.status,
      providerMetadata: providerResult?.metadata ? toPrismaJson(providerResult.metadata) : undefined,
      providerSyncedAt: providerResult ? new Date() : undefined
    }
  });
  if (meeting.recordingPlanned) await preparePlannedRecordingConsent(workspaceId, meeting.id, user.id);
  if (meeting.recordingPlanned) await audit(workspaceId, "meeting.recording_policy_enabled", "MeetingRoom", meeting.id, user.id, { meetingId: meeting.id });
  if (meeting.lobbyEnabled) await audit(workspaceId, "meeting.lobby_enabled", "MeetingRoom", meeting.id, user.id, { meetingId: meeting.id });
  await audit(workspaceId, "meeting.created", "MeetingRoom", meeting.id, user.id, { scheduledAt: meeting.scheduledAt, callSessionId, provider: meeting.provider });
  if (meeting.provider === "ZOOM") await audit(workspaceId, "zoom.meeting_created", "MeetingRoom", meeting.id, user.id, { providerMeetingId: meeting.providerMeetingId, providerHostId: meeting.providerHostId });
  if (callSessionId) await audit(workspaceId, "meeting.call_session_linked", "MeetingRoom", meeting.id, user.id, { callSessionId });
  return meeting;
}

export async function updateMeeting(workspaceId: string, meetingId: string, input: MeetingInput) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const existing = await prisma.meetingRoom.findFirst({ where: { id: meetingId, workspaceId } });
  if (!existing) notFound();
  const title = clean(input.title);
  if (!title) throw new Error("Meeting title is required.");
  const leadId = clean(input.leadId);
  const contactId = clean(input.contactId);
  const companyId = clean(input.companyId);
  const opportunityId = clean(input.opportunityId);
  const callSessionId = clean(input.callSessionId);
  const scheduledAt = clean(input.scheduledAt);
  await Promise.all([
    assertWorkspaceLink("lead", workspaceId, leadId),
    assertWorkspaceLink("contact", workspaceId, contactId),
    assertWorkspaceLink("company", workspaceId, companyId),
    assertWorkspaceLink("opportunity", workspaceId, opportunityId),
    assertAvailableCallSession(workspaceId, callSessionId, meetingId)
  ]);
  const recordingPreference = input.recordingPreference || (input.recordingPlanned ? "ZOOM_CLOUD" : "NONE");
  const recordingPlanned = recordingPreference !== "NONE";
  const recordingConsentRequired = recordingPlanned;
  const lobbyEnabled = Boolean(input.lobbyEnabled);
  if (!recordingPlanned && existing.recordingPlanned) {
    const active = await prisma.meetingRecording.count({ where: { workspaceId, meetingRoomId: meetingId, status: { in: ["CONSENT_REQUIRED", "READY", "STARTING", "RECORDING", "STOPPING", "PROCESSING"] } } });
    if (active) throw new Error("Recording policy cannot be disabled while a recording draft or active recording exists.");
  }
  if (!lobbyEnabled && existing.lobbyEnabled) {
    const waiting = await prisma.meetingLobbyEntry.count({ where: { workspaceId, meetingRoomId: meetingId, status: "WAITING" } });
    if (waiting) throw new Error("Admit, deny, or cancel waiting participants before disabling the lobby.");
  }
  let providerUpdate: Awaited<ReturnType<ZoomMeetingAdapter["updateMeeting"]>> | undefined;
  if (existing.provider === "ZOOM" && existing.providerMeetingId) {
    const integration = await getConnectedZoomIntegration(workspaceId);
    if (!integration) throw new Error("Reconnect Zoom before updating this Zoom-backed meeting.");
    providerUpdate = await new ZoomMeetingAdapter(integration).updateMeeting(existing.providerMeetingId, { workspaceId, title: title.slice(0,160), description: clean(input.description)?.slice(0,2000), scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined, waitingRoom: lobbyEnabled, recordingPlanned, recordingPreference, hostId: existing.providerHostId || undefined, durationMinutes: input.durationMinutes || 60 });
  }
  const meeting = await prisma.meetingRoom.update({
    where: { id: meetingId },
    data: {
      title: title.slice(0, 160),
      description: clean(input.description)?.slice(0, 2000),
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      leadId,
      contactId,
      companyId,
      opportunityId,
      callSessionId,
      recordingPlanned,
      recordingPreference,
      recordingConsentRequired,
      lobbyEnabled,
      lobbyPolicyUpdatedAt: lobbyEnabled !== existing.lobbyEnabled ? new Date() : existing.lobbyPolicyUpdatedAt,
      providerStatus: providerUpdate?.status ?? existing.providerStatus,
      providerSyncedAt: providerUpdate ? new Date() : existing.providerSyncedAt
    }
  });
  if (recordingPlanned && !existing.recordingPlanned) await preparePlannedRecordingConsent(workspaceId, meeting.id, user.id);
  if (recordingPlanned !== existing.recordingPlanned) await audit(workspaceId, recordingPlanned ? "meeting.recording_policy_enabled" : "meeting.recording_policy_disabled", "MeetingRoom", meeting.id, user.id, { meetingId: meeting.id });
  if (lobbyEnabled !== existing.lobbyEnabled) await audit(workspaceId, lobbyEnabled ? "meeting.lobby_enabled" : "meeting.lobby_disabled", "MeetingRoom", meeting.id, user.id, { meetingId: meeting.id });
  if (meeting.scheduledAt) {
    const maxExpiry = maxInvitationExpiry(meeting.scheduledAt);
    await prisma.meetingInvitation.updateMany({ where: { meetingId: meeting.id, workspaceId, revokedAt: null, expiresAt: { gt: maxExpiry } }, data: { expiresAt: maxExpiry, tokenVersion: { increment: 1 } } });
  }
  await audit(workspaceId, "meeting.updated", "MeetingRoom", meeting.id, user.id, { scheduledAt: meeting.scheduledAt, callSessionId, provider: meeting.provider });
  if (meeting.provider === "ZOOM") await audit(workspaceId, "zoom.meeting_updated", "MeetingRoom", meeting.id, user.id, { providerMeetingId: meeting.providerMeetingId });
  if (existing.callSessionId !== callSessionId && callSessionId) await audit(workspaceId, "meeting.call_session_linked", "MeetingRoom", meeting.id, user.id, { callSessionId });
  return meeting;
}

function parseGuestRole(role?: string): MeetingParticipantRole {
  return role === "PARTICIPANT" ? "PARTICIPANT" : "GUEST";
}

function resolveInvitationExpiry(meeting: { scheduledAt: Date | null }, expiresAt?: string) {
  const max = maxInvitationExpiry(meeting.scheduledAt);
  const requested = clean(expiresAt) ? new Date(String(expiresAt)) : max;
  if (Number.isNaN(requested.getTime())) throw new Error("Invitation expiration is invalid.");
  if (requested > max) throw new Error("Invitation cannot expire later than 24 hours after the scheduled meeting time.");
  return requested;
}

export async function createMeetingInvitation(workspaceId: string, meetingId: string, input: InvitationInput = {}) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const meeting = await prisma.meetingRoom.findFirst({ where: { id: meetingId, workspaceId } });
  if (!meeting) notFound();
  const legacyToken = randomBytes(32).toString("base64url");
  const invitation = await prisma.meetingInvitation.create({
    data: {
      workspaceId,
      meetingId,
      tokenHash: hashInvitationToken(legacyToken),
      displayName: clean(input.displayName)?.slice(0, 80),
      email: clean(input.email)?.slice(0, 254),
      role: parseGuestRole(input.role),
      expiresAt: resolveInvitationExpiry(meeting, input.expiresAt),
      createdById: user.id
    }
  });
  await audit(workspaceId, "meeting.invitation_created", "MeetingRoom", meetingId, user.id, { invitationId: invitation.id, displayName: invitation.displayName, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt });
  return { invitation, url: await getMeetingInvitationUrl(workspaceId, meetingId, invitation.id) };
}

export async function getMeetingInvitationUrl(workspaceId: string, meetingId: string, invitationId: string) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const invitation = await prisma.meetingInvitation.findFirst({ where: { id: invitationId, meetingId, workspaceId }, include: { meeting: true } });
  if (!invitation) notFound();
  if (invitation.revokedAt) throw new Error("This invitation has been revoked.");
  if (!invitation.expiresAt || invitation.expiresAt <= new Date()) throw new Error("This invitation has expired.");
  const credential = signMeetingInvitationCredential({ invitationId: invitation.id, meetingId: invitation.meetingId, tokenVersion: invitation.tokenVersion, expiresAt: invitation.expiresAt });
  await prisma.meetingInvitation.update({ where: { id: invitation.id }, data: { lastCopiedAt: new Date() } });
  await audit(workspaceId, "meeting.invitation_link_copied", "MeetingRoom", meetingId, user.id, { invitationId: invitation.id, action: "copy_link" });
  return buildMeetingInvitationUrl(invitation.meeting.slug, credential);
}

export async function updateMeetingInvitation(workspaceId: string, meetingId: string, invitationId: string, input: InvitationInput) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const invitation = await prisma.meetingInvitation.findFirst({ where: { id: invitationId, meetingId, workspaceId }, include: { meeting: true } });
  if (!invitation) notFound();
  if (invitation.revokedAt) throw new Error("Revoked invitations cannot be edited.");
  const expiresAt = resolveInvitationExpiry(invitation.meeting, input.expiresAt);
  const updated = await prisma.meetingInvitation.update({ where: { id: invitation.id }, data: { displayName: clean(input.displayName)?.slice(0, 80), email: clean(input.email)?.slice(0, 254), role: parseGuestRole(input.role), expiresAt, tokenVersion: { increment: 1 } } });
  await audit(workspaceId, "meeting.invitation_edited", "MeetingRoom", meetingId, user.id, { invitationId, displayName: updated.displayName, email: updated.email, role: updated.role, expiresAt: updated.expiresAt });
  return updated;
}

export async function revokeMeetingInvitation(workspaceId: string, meetingId: string, invitationId: string) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const invitation = await prisma.meetingInvitation.findFirst({ where: { id: invitationId, meetingId, workspaceId } });
  if (!invitation) notFound();
  if (!invitation.revokedAt) await prisma.meetingInvitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
  await audit(workspaceId, "meeting.invitation_revoked", "MeetingRoom", meetingId, user.id, { invitationId });
}


async function findValidInvitation(meetingId: string, token: string) {
  const credential = verifyMeetingInvitationCredential(token);
  if (credential) {
    return prisma.meetingInvitation.findFirst({ where: { id: credential.invitationId, meetingId, tokenVersion: credential.version } });
  }
  return prisma.meetingInvitation.findFirst({ where: { meetingId, tokenHash: hashInvitationToken(token) } });
}

export async function getPublicMeeting(slug: string, invitationToken?: string) {
  const meeting = await prisma.meetingRoom.findUnique({ where: { slug }, select: { id: true, workspaceId: true, slug: true, title: true, description: true, scheduledAt: true, status: true, provider: true, recordingConsentRequired: true } });
  if (!meeting) return { meeting: null, accessError: "This meeting link is not valid." };
  if (!invitationToken) return { meeting: { ...meeting, invitationDisplayName: null }, accessError: "A valid invitation is required to join this meeting." };
  const invitation = await findValidInvitation(meeting.id, invitationToken);
  if (!invitation) return { meeting: { ...meeting, invitationDisplayName: null }, accessError: "This invitation is not valid." };
  if (invitation.revokedAt) return { meeting: { ...meeting, invitationDisplayName: null }, accessError: "This invitation has been revoked." };
  if (invitation.expiresAt && invitation.expiresAt <= new Date()) return { meeting: { ...meeting, invitationDisplayName: null }, accessError: "This invitation has expired." };
  if (meeting.status === "ENDED" || meeting.status === "CANCELED") return { meeting: { ...meeting, invitationDisplayName: null }, accessError: "This meeting is no longer joinable." };
  return { meeting: { ...meeting, invitationDisplayName: invitation.displayName }, accessError: null };
}

export async function authorizeMeetingJoin(input: JoinAuthorizationInput) {
  const meeting = await prisma.meetingRoom.findUnique({ where: { id: input.meetingId } });
  if (!meeting) throw new Error("Meeting not found.");
  if (meeting.status === "ENDED" || meeting.status === "CANCELED") throw new Error("This meeting is no longer joinable.");

  const user = await getOptionalUserProfile();
  if (user) {
    const membership = await prisma.workspaceMember.findFirst({ where: { workspaceId: meeting.workspaceId, userId: user.id, status: "ACTIVE", workspace: { status: "ACTIVE" } } });
    if (membership) {
      const existing = await prisma.meetingParticipant.findFirst({ where: { meetingId: meeting.id, userId: user.id } });
      const role: MeetingParticipantRole = meeting.hostId === user.id ? "HOST" : existing?.role === "CO_HOST" ? "CO_HOST" : "PARTICIPANT";
      const displayName = safeDisplayName(input.displayName, [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email);
      const identity = participantIdentity(meeting.id, `user:${user.id}`);
      const participant = await prisma.meetingParticipant.upsert({
        where: { meetingId_identity: { meetingId: meeting.id, identity } },
        update: { displayName, role, userId: user.id },
        create: { workspaceId: meeting.workspaceId, meetingId: meeting.id, userId: user.id, identity, displayName, role }
      });
      return { meeting, participant, actorId: user.id };
    }
  }

  const invitationToken = clean(input.invitationToken);
  if (!invitationToken) throw new Error("A valid invitation is required.");
  const invitation = await findValidInvitation(meeting.id, invitationToken);
  if (!invitation) throw new Error("This invitation is not valid.");
  if (invitation.revokedAt) throw new Error("This invitation has been revoked.");
  if (invitation.expiresAt && invitation.expiresAt <= new Date()) throw new Error("This invitation has expired.");
  const displayName = safeDisplayName(input.displayName, invitation.displayName ?? "Guest");
  const identity = participantIdentity(meeting.id, `invitation:${invitation.id}`);
  const participant = await prisma.meetingParticipant.upsert({
    where: { meetingId_identity: { meetingId: meeting.id, identity } },
    update: { displayName, role: invitation.role, invitationId: invitation.id },
    create: { workspaceId: meeting.workspaceId, meetingId: meeting.id, invitationId: invitation.id, identity, displayName, role: invitation.role }
  });
  return { meeting, participant, actorId: undefined };
}

export async function getZoomJoinUrl(meetingId: string, invitationToken?: string, displayName?: string, recordingConsentAccepted = false) {
  const authorization = await authorizeMeetingJoin({ meetingId, invitationToken, displayName });
  if (authorization.meeting.provider === "NATIVE_LIVEKIT") {
    await audit(authorization.meeting.workspaceId, "legacy_native_runtime_blocked", "MeetingRoom", meetingId, authorization.actorId, { meetingParticipantId: authorization.participant.id });
    throw new Error("Native meeting hosting has been retired.");
  }
  if (authorization.meeting.provider !== "ZOOM" || !authorization.meeting.providerJoinUrl) throw new Error("This meeting is not Zoom-backed.");
  if (authorization.meeting.recordingConsentRequired && !recordingConsentAccepted) throw new Error("Recording consent is required before joining Zoom.");
  if (authorization.meeting.recordingConsentRequired && recordingConsentAccepted) {
    const recording = await prisma.meetingRecording.findFirst({ where: { meetingRoomId: meetingId, workspaceId: authorization.meeting.workspaceId }, orderBy: { createdAt: "desc" } });
    if (recording) await prisma.meetingRecordingConsent.upsert({
      where: { recordingId_livekitIdentity: { recordingId: recording.id, livekitIdentity: authorization.participant.identity } },
      update: { consentStatus: "CONSENTED", respondedAt: new Date(), displayName: authorization.participant.displayName },
      create: { workspaceId: authorization.meeting.workspaceId, meetingRoomId: meetingId, recordingId: recording.id, meetingParticipantId: authorization.participant.id, livekitIdentity: authorization.participant.identity, displayName: authorization.participant.displayName, consentStatus: "CONSENTED", respondedAt: new Date() }
    });
  }
  await audit(authorization.meeting.workspaceId, "zoom.guest_join_redirected", "MeetingRoom", meetingId, authorization.actorId, { meetingParticipantId: authorization.participant.id });
  return authorization.meeting.providerJoinUrl;
}

export async function getZoomStartUrl(workspaceId: string, meetingId: string) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const meeting = await prisma.meetingRoom.findFirst({ where: { id: meetingId, workspaceId } });
  if (!meeting || meeting.hostId !== user.id) throw new Error("Only the meeting host can start this Zoom meeting.");
  if (meeting.provider !== "ZOOM" || !meeting.providerStartUrlEncrypted) throw new Error("This meeting does not have a Zoom host start URL.");
  await audit(workspaceId, "zoom.host_start_redirected", "MeetingRoom", meetingId, user.id, { providerMeetingId: meeting.providerMeetingId });
  return decryptSecret(meeting.providerStartUrlEncrypted);
}

export async function recordTokenIssued(meetingId: string, participantId: string, actorId?: string) {
  const meeting = await prisma.meetingRoom.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new Error("Meeting not found.");
  await prisma.$transaction([
    prisma.meetingRoom.update({ where: { id: meeting.id }, data: { status: "LIVE", startedAt: meeting.startedAt ?? new Date() } }),
    prisma.meetingEvent.create({ data: { workspaceId: meeting.workspaceId, meetingId, participantId, type: "TOKEN_ISSUED", eventKey: `token:${randomUUID()}` } }),
    prisma.meetingEvent.upsert({
      where: { eventKey: `room-opened:${meeting.id}` },
      update: {},
      create: { workspaceId: meeting.workspaceId, meetingId, participantId, type: "ROOM_OPENED", eventKey: `room-opened:${meeting.id}` }
    })
  ]);
  await audit(meeting.workspaceId, "meeting.token_issued", "MeetingRoom", meeting.id, actorId, { participantId });
  if (!meeting.startedAt) await audit(meeting.workspaceId, "meeting.room_opened", "MeetingRoom", meeting.id, actorId);
}

export async function recordMeetingLifecycle(
  authorization: Awaited<ReturnType<typeof authorizeMeetingJoin>>,
  type: Extract<MeetingEventType, "PARTICIPANT_JOINED" | "PARTICIPANT_LEFT" | "SCREEN_SHARE_STARTED" | "SCREEN_SHARE_STOPPED">,
  eventId?: string
) {
  const { meeting, participant, actorId } = authorization;
  const stable = type === "PARTICIPANT_JOINED" ? `joined:${participant.id}` : type === "PARTICIPANT_LEFT" ? `left:${participant.id}` : `${type.toLowerCase()}:${participant.id}:${clean(eventId) ?? randomUUID()}`;
  const now = new Date();
  await prisma.$transaction([
    prisma.meetingParticipant.update({
      where: { id: participant.id },
      data: type === "PARTICIPANT_JOINED" ? { joinedAt: participant.joinedAt ?? now, leftAt: null } : type === "PARTICIPANT_LEFT" ? { leftAt: now } : {}
    }),
    prisma.meetingEvent.upsert({
      where: { eventKey: stable },
      update: {},
      create: { workspaceId: meeting.workspaceId, meetingId: meeting.id, participantId: participant.id, type, eventKey: stable, metadata: toPrismaJson({ role: participant.role, displayName: participant.displayName }) }
    })
  ]);
  const actions: Record<typeof type, string> = {
    PARTICIPANT_JOINED: "meeting.participant_joined",
    PARTICIPANT_LEFT: "meeting.participant_left",
    SCREEN_SHARE_STARTED: "meeting.screen_share_started",
    SCREEN_SHARE_STOPPED: "meeting.screen_share_stopped"
  };
  await audit(meeting.workspaceId, actions[type], "MeetingRoom", meeting.id, actorId, { participantId: participant.id, role: participant.role, displayName: participant.displayName });
}

export async function endMeeting(authorization: Awaited<ReturnType<typeof authorizeMeetingJoin>>) {
  const { meeting, participant, actorId } = authorization;
  const allowed = participant.role === "HOST" || participant.role === "CO_HOST";
  if (!allowed || !actorId) throw new Error("You are not authorized to end this meeting.");
  if (meeting.status !== "ENDED") {
    const now = new Date();
    await prisma.$transaction([
      prisma.meetingRoom.update({ where: { id: meeting.id }, data: { status: "ENDED", endedAt: meeting.endedAt ?? now } }),
      prisma.meetingLobbyEntry.updateMany({ where: { meetingRoomId: meeting.id, workspaceId: meeting.workspaceId, status: "WAITING" }, data: { status: "CANCELLED", leftAt: now } }),
      prisma.meetingEvent.upsert({
        where: { eventKey: `room-ended:${meeting.id}` },
        update: {},
        create: { workspaceId: meeting.workspaceId, meetingId: meeting.id, participantId: participant.id, type: "ROOM_ENDED", eventKey: `room-ended:${meeting.id}`, occurredAt: now }
      })
    ]);
    const activeRecording = await prisma.meetingRecording.findFirst({ where: { workspaceId: meeting.workspaceId, meetingRoomId: meeting.id, status: { in: ["STARTING", "RECORDING"] } } });
    if (activeRecording) {
      const { stopRecording } = await import("@/lib/meetings/recordings");
      await stopRecording(meeting.workspaceId, meeting.id, activeRecording.id).catch(() => undefined);
    }
    await audit(meeting.workspaceId, "meeting.room_ended", "MeetingRoom", meeting.id, actorId, { role: participant.role, activeRecordingId: activeRecording?.id });
  }
}
