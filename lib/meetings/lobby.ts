import "server-only";

import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import type { MeetingLobbyStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { toPrismaJson } from "@/lib/db/json";
import { audit } from "@/lib/audit/service";
import { authorizeMeetingJoin } from "@/lib/meetings/service";
import { ensureParticipantConsentRow } from "@/lib/meetings/recordings";

export type LobbyAuthorization = Awaited<ReturnType<typeof authorizeMeetingJoin>>;

function canBypassLobby(auth: LobbyAuthorization) {
  return auth.participant.role === "HOST" || auth.participant.role === "CO_HOST";
}

async function meetingEvent(auth: LobbyAuthorization, type: "LOBBY_JOIN_REQUESTED" | "PARTICIPANT_ADMITTED" | "PARTICIPANT_DENIED" | "PARTICIPANT_LEFT_LOBBY", entryId: string, actorId?: string) {
  await prisma.meetingEvent.create({ data: { workspaceId: auth.meeting.workspaceId, meetingId: auth.meeting.id, participantId: auth.participant.id, type, eventKey: `${type.toLowerCase()}:${entryId}:${randomUUID()}`, metadata: toPrismaJson({ lobbyEntryId: entryId, displayName: auth.participant.displayName, role: auth.participant.role, actorId }) } });
}

async function requiredRecording(auth: LobbyAuthorization) {
  if (!auth.meeting.recordingPlanned || !auth.meeting.recordingConsentRequired) return null;
  return prisma.meetingRecording.findFirst({ where: { workspaceId: auth.meeting.workspaceId, meetingRoomId: auth.meeting.id, status: { in: ["CONSENT_REQUIRED", "READY", "STARTING", "RECORDING"] } }, include: { consents: { where: { livekitIdentity: auth.participant.identity } } }, orderBy: { createdAt: "desc" } });
}

export async function assertConsentBeforeLobby(auth: LobbyAuthorization) {
  const recording = await requiredRecording(auth);
  if (!recording) return;
  const consent = recording.consents[0] ?? await ensureParticipantConsentRow(recording.id, auth.participant, auth.meeting);
  if (consent.consentStatus !== "CONSENTED") throw new Error(consent.consentStatus === "DECLINED" ? "You declined recording consent and cannot join this recorded session." : "Recording consent is required before entering the meeting lobby.");
}

export async function requestLobbyEntry(input: { meetingId: string; invitationToken?: string; displayName?: string }) {
  const auth = await authorizeMeetingJoin(input);
  if (!auth.meeting.lobbyEnabled || canBypassLobby(auth)) return { bypass: true, status: "ADMITTED" as MeetingLobbyStatus, meeting: auth.meeting, participant: auth.participant };
  await assertConsentBeforeLobby(auth);
  if (auth.meeting.status === "ENDED" || auth.meeting.status === "CANCELED") throw new Error("This meeting is no longer accepting participants.");
  const existing = await prisma.meetingLobbyEntry.findUnique({ where: { meetingRoomId_livekitIdentity: { meetingRoomId: auth.meeting.id, livekitIdentity: auth.participant.identity } } });
  if (existing?.status === "ADMITTED") return { ...existing, bypass: false };
  const entry = await prisma.meetingLobbyEntry.upsert({
    where: { meetingRoomId_livekitIdentity: { meetingRoomId: auth.meeting.id, livekitIdentity: auth.participant.identity } },
    update: { status: "WAITING", displayName: auth.participant.displayName, role: auth.participant.role, userId: auth.participant.userId, invitationId: auth.participant.invitationId, leftAt: null, requestedAt: new Date() },
    create: { workspaceId: auth.meeting.workspaceId, meetingRoomId: auth.meeting.id, livekitIdentity: auth.participant.identity, displayName: auth.participant.displayName, role: auth.participant.role, userId: auth.participant.userId, invitationId: auth.participant.invitationId, status: "WAITING" }
  });
  await meetingEvent(auth, "LOBBY_JOIN_REQUESTED", entry.id);
  await audit(auth.meeting.workspaceId, existing?.status === "DENIED" ? "meeting.participant_requested_lobby_again" : "meeting.participant_entered_lobby", "MeetingLobbyEntry", entry.id, auth.actorId, { meetingId: auth.meeting.id, lobbyEntryId: entry.id, displayName: entry.displayName, role: entry.role, status: entry.status, previousStatus: existing?.status });
  return { ...entry, bypass: false };
}

export async function getLobbyStatus(input: { meetingId: string; invitationToken?: string; displayName?: string }) {
  const auth = await authorizeMeetingJoin(input);
  const hostEntries = canBypassLobby(auth) ? await prisma.meetingLobbyEntry.findMany({ where: { workspaceId: auth.meeting.workspaceId, meetingRoomId: auth.meeting.id, status: { in: ["WAITING", "DENIED"] } }, orderBy: [{ status: "desc" }, { requestedAt: "asc" }] }) : [];
  const waiting = hostEntries.filter((entry) => entry.status === "WAITING");
  const self = await prisma.meetingLobbyEntry.findUnique({ where: { meetingRoomId_livekitIdentity: { meetingRoomId: auth.meeting.id, livekitIdentity: auth.participant.identity } } });
  return { lobbyEnabled: auth.meeting.lobbyEnabled, bypass: canBypassLobby(auth), status: self?.status ?? (canBypassLobby(auth) ? "ADMITTED" : null), displayName: auth.participant.displayName, meetingStatus: auth.meeting.status, waitingCount: waiting.length, entries: hostEntries.map(e => ({ id: e.id, displayName: e.displayName, email: e.email, role: e.role, status: e.status, requestedAt: e.requestedAt, consentStatus: "CONSENTED" })) };
}

async function assertLobbyHost(meetingId: string, entryId: string, displayName?: string) {
  const auth = await authorizeMeetingJoin({ meetingId, displayName });
  if (!canBypassLobby(auth) || !auth.actorId) throw new Error("Only the host or co-host can manage the waiting lobby.");
  const entry = await prisma.meetingLobbyEntry.findFirst({ where: { id: entryId, workspaceId: auth.meeting.workspaceId, meetingRoomId: auth.meeting.id } });
  if (!entry) notFound();
  return { auth, entry };
}

export async function admitLobbyEntry(meetingId: string, entryId: string, displayName?: string) {
  const { auth, entry } = await assertLobbyHost(meetingId, entryId, displayName);
  if (auth.meeting.status === "ENDED" || auth.meeting.status === "CANCELED") throw new Error("This meeting is no longer accepting participants.");
  const participant = await prisma.meetingParticipant.findUnique({ where: { meetingId_identity: { meetingId, identity: entry.livekitIdentity } } });
  if (!participant) throw new Error("Lobby participant is no longer available.");
  await assertConsentBeforeLobby({ ...auth, participant });
  const reconsidered = entry.status === "DENIED";
  const updated = await prisma.meetingLobbyEntry.update({ where: { id: entry.id }, data: { status: "ADMITTED", admittedAt: new Date(), admittedById: auth.actorId } });
  await meetingEvent({ ...auth, participant }, "PARTICIPANT_ADMITTED", entry.id, auth.actorId);
  await audit(auth.meeting.workspaceId, reconsidered ? "meeting.denied_participant_admitted" : "meeting.participant_admitted", "MeetingLobbyEntry", entry.id, auth.actorId, { meetingId, lobbyEntryId: entry.id, displayName: entry.displayName, role: entry.role, status: updated.status, previousStatus: entry.status });
  return updated;
}

export async function denyLobbyEntry(meetingId: string, entryId: string, displayName?: string) {
  const { auth, entry } = await assertLobbyHost(meetingId, entryId, displayName);
  const updated = await prisma.meetingLobbyEntry.update({ where: { id: entry.id }, data: { status: "DENIED", deniedAt: entry.deniedAt ?? new Date(), deniedById: auth.actorId } });
  await meetingEvent(auth, "PARTICIPANT_DENIED", entry.id, auth.actorId);
  await audit(auth.meeting.workspaceId, "meeting.participant_denied", "MeetingLobbyEntry", entry.id, auth.actorId, { meetingId, lobbyEntryId: entry.id, displayName: entry.displayName, role: entry.role, status: updated.status });
  return updated;
}

export async function leaveLobby(input: { meetingId: string; invitationToken?: string; displayName?: string }) {
  const auth = await authorizeMeetingJoin(input);
  const entry = await prisma.meetingLobbyEntry.findUnique({ where: { meetingRoomId_livekitIdentity: { meetingRoomId: auth.meeting.id, livekitIdentity: auth.participant.identity } } });
  if (!entry || entry.status !== "WAITING") return entry;
  const updated = await prisma.meetingLobbyEntry.update({ where: { id: entry.id }, data: { status: "CANCELLED", leftAt: new Date() } });
  await meetingEvent(auth, "PARTICIPANT_LEFT_LOBBY", entry.id);
  await audit(auth.meeting.workspaceId, "meeting.participant_left_lobby", "MeetingLobbyEntry", entry.id, auth.actorId, { meetingId: auth.meeting.id, lobbyEntryId: entry.id, displayName: entry.displayName, role: entry.role, status: updated.status });
  return updated;
}

export async function assertLobbyAdmissionForToken(auth: LobbyAuthorization) {
  if (!auth.meeting.lobbyEnabled || canBypassLobby(auth)) return;
  const entry = await prisma.meetingLobbyEntry.findUnique({ where: { meetingRoomId_livekitIdentity: { meetingRoomId: auth.meeting.id, livekitIdentity: auth.participant.identity } } });
  if (entry?.status === "ADMITTED") return;
  await audit(auth.meeting.workspaceId, "meeting.token_denied_lobby_admission_missing", "MeetingRoom", auth.meeting.id, auth.actorId, { meetingId: auth.meeting.id, participantId: auth.participant.id, status: entry?.status ?? "MISSING" });
  if (entry?.status === "WAITING") throw new Error("You are waiting for the host to admit you.");
  if (entry?.status === "DENIED") throw new Error("The host did not admit you to this meeting.");
  throw new Error("Request access from the meeting lobby first.");
}

export async function cancelWaitingLobbyEntries(meetingId: string, workspaceId: string) {
  await prisma.meetingLobbyEntry.updateMany({ where: { meetingRoomId: meetingId, workspaceId, status: "WAITING" }, data: { status: "CANCELLED", leftAt: new Date() } });
}
