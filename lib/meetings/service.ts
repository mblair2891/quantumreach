import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import type { MeetingEventType, MeetingParticipantRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { audit } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { toPrismaJson } from "@/lib/db/json";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";

type MeetingInput = {
  title: string;
  description?: string;
  scheduledAt?: string;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  opportunityId?: string;
  callSessionId?: string;
};

type JoinAuthorizationInput = {
  meetingId: string;
  invitationToken?: string;
  displayName?: string;
};

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
  const [leads, contacts, companies, opportunities, callSessions] = await Promise.all([
    prisma.lead.findMany({ where: { workspaceId, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.contact.findMany({ where: { workspaceId, status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.company.findMany({ where: { workspaceId, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.opportunity.findMany({ where: { workspaceId, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.callSession.findMany({ where: { workspaceId, meetingRoom: null }, select: { id: true, provider: true, callDate: true }, orderBy: { updatedAt: "desc" }, take: 100 })
  ]);
  return { leads, contacts, companies, opportunities, callSessions };
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
      events: { orderBy: { occurredAt: "desc" }, take: 20, include: { participant: true } }
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
  await Promise.all([
    assertWorkspaceLink("lead", workspaceId, leadId),
    assertWorkspaceLink("contact", workspaceId, contactId),
    assertWorkspaceLink("company", workspaceId, companyId),
    assertWorkspaceLink("opportunity", workspaceId, opportunityId),
    assertAvailableCallSession(workspaceId, callSessionId)
  ]);
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
      roomName: `quantum-reach-${roomEntropy}`
    }
  });
  await audit(workspaceId, "meeting.created", "MeetingRoom", meeting.id, user.id, { scheduledAt: meeting.scheduledAt, callSessionId });
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
      callSessionId
    }
  });
  await audit(workspaceId, "meeting.updated", "MeetingRoom", meeting.id, user.id, { scheduledAt: meeting.scheduledAt, callSessionId });
  if (existing.callSessionId !== callSessionId && callSessionId) await audit(workspaceId, "meeting.call_session_linked", "MeetingRoom", meeting.id, user.id, { callSessionId });
  return meeting;
}

export async function createMeetingInvitation(workspaceId: string, meetingId: string, expiresAt?: string) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const meeting = await prisma.meetingRoom.findFirst({ where: { id: meetingId, workspaceId } });
  if (!meeting) notFound();
  const token = randomBytes(32).toString("base64url");
  const expiration = clean(expiresAt);
  const invitation = await prisma.meetingInvitation.create({
    data: {
      workspaceId,
      meetingId,
      tokenHash: hashInvitationToken(token),
      role: "GUEST",
      expiresAt: expiration ? new Date(expiration) : undefined,
      createdById: user.id
    }
  });
  await audit(workspaceId, "meeting.invitation_created", "MeetingRoom", meetingId, user.id, { invitationId: invitation.id, expiresAt: invitation.expiresAt });
  return { invitation, token };
}

export async function revokeMeetingInvitation(workspaceId: string, meetingId: string, invitationId: string) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const invitation = await prisma.meetingInvitation.findFirst({ where: { id: invitationId, meetingId, workspaceId } });
  if (!invitation) notFound();
  if (!invitation.revokedAt) await prisma.meetingInvitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
  await audit(workspaceId, "meeting.invitation_revoked", "MeetingRoom", meetingId, user.id, { invitationId });
}

export async function getPublicMeeting(slug: string, invitationToken?: string) {
  const meeting = await prisma.meetingRoom.findUnique({ where: { slug }, select: { id: true, slug: true, title: true, description: true, scheduledAt: true, status: true } });
  if (!meeting) return { meeting: null, accessError: "This meeting link is not valid." };
  if (!invitationToken) return { meeting, accessError: "A valid invitation is required to join this meeting." };
  const invitation = await prisma.meetingInvitation.findFirst({ where: { meetingId: meeting.id, tokenHash: hashInvitationToken(invitationToken) } });
  if (!invitation) return { meeting, accessError: "This invitation is not valid." };
  if (invitation.revokedAt) return { meeting, accessError: "This invitation has been revoked." };
  if (invitation.expiresAt && invitation.expiresAt <= new Date()) return { meeting, accessError: "This invitation has expired." };
  if (meeting.status === "ENDED" || meeting.status === "CANCELED") return { meeting, accessError: "This meeting is no longer joinable." };
  return { meeting, accessError: null };
}

export async function authorizeMeetingJoin(input: JoinAuthorizationInput) {
  const meeting = await prisma.meetingRoom.findUnique({ where: { id: input.meetingId } });
  if (!meeting) throw new Error("Meeting not found.");
  if (meeting.status === "ENDED" || meeting.status === "CANCELED") throw new Error("This meeting is no longer joinable.");

  const { userId: clerkUserId } = await auth();
  if (clerkUserId) {
    const user = await prisma.userProfile.findUnique({ where: { clerkUserId } });
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
  }

  const invitationToken = clean(input.invitationToken);
  if (!invitationToken) throw new Error("A valid invitation is required.");
  const invitation = await prisma.meetingInvitation.findFirst({ where: { meetingId: meeting.id, tokenHash: hashInvitationToken(invitationToken) } });
  if (!invitation) throw new Error("This invitation is not valid.");
  if (invitation.revokedAt) throw new Error("This invitation has been revoked.");
  if (invitation.expiresAt && invitation.expiresAt <= new Date()) throw new Error("This invitation has expired.");
  const displayName = safeDisplayName(input.displayName, "Guest");
  const identity = participantIdentity(meeting.id, `invitation:${invitation.id}`);
  const participant = await prisma.meetingParticipant.upsert({
    where: { meetingId_identity: { meetingId: meeting.id, identity } },
    update: { displayName, role: invitation.role, invitationId: invitation.id },
    create: { workspaceId: meeting.workspaceId, meetingId: meeting.id, invitationId: invitation.id, identity, displayName, role: invitation.role }
  });
  return { meeting, participant, actorId: undefined };
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
      prisma.meetingRoom.update({ where: { id: meeting.id }, data: { status: "ENDED", endedAt: now } }),
      prisma.meetingEvent.upsert({
        where: { eventKey: `room-ended:${meeting.id}` },
        update: {},
        create: { workspaceId: meeting.workspaceId, meetingId: meeting.id, participantId: participant.id, type: "ROOM_ENDED", eventKey: `room-ended:${meeting.id}`, occurredAt: now }
      })
    ]);
    await audit(meeting.workspaceId, "meeting.room_ended", "MeetingRoom", meeting.id, actorId, { role: participant.role });
  }
}
