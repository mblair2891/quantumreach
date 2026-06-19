import "server-only";
import { prisma } from "@/lib/db/prisma";
import { toPrismaJson } from "@/lib/db/json";
import { audit } from "@/lib/audit/service";

export function zoomEventTimestamp(eventTs?: number, fallback = new Date()) {
  if (!eventTs) return fallback;
  return new Date(eventTs > 10_000_000_000 ? eventTs : eventTs * 1000);
}

export async function applyZoomMeetingStarted(meeting: { id:string; workspaceId:string; startedAt:Date|null; endedAt:Date|null; providerMeetingId:string|null }, providerMeetingId:string, occurredAt:Date) {
  const startedAt = meeting.startedAt ?? (meeting.endedAt && occurredAt > meeting.endedAt ? meeting.endedAt : occurredAt);
  const updated = await prisma.meetingRoom.update({ where:{id:meeting.id}, data:{ status: meeting.endedAt ? "ENDED" : "LIVE", startedAt, providerStatus: meeting.endedAt ? "ended" : "in_progress", providerSyncedAt:new Date() } });
  await prisma.meetingEvent.upsert({ where:{eventKey:`zoom-started:${meeting.id}`}, update:{}, create:{ workspaceId:meeting.workspaceId, meetingId:meeting.id, type:"ROOM_OPENED", eventKey:`zoom-started:${meeting.id}`, occurredAt:startedAt, metadata:toPrismaJson({provider:"ZOOM", providerMeetingId}) } });
  await audit(meeting.workspaceId,"zoom.meeting_started","MeetingRoom",meeting.id,undefined,{providerMeetingId});
  return updated;
}

export async function applyZoomMeetingEnded(meeting: { id:string; workspaceId:string; endedAt:Date|null; startedAt:Date|null; providerMeetingId:string|null }, providerMeetingId:string, occurredAt:Date) {
  const endedAt = meeting.endedAt ?? occurredAt;
  const startedAt = meeting.startedAt ?? occurredAt;
  const updated = await prisma.meetingRoom.update({ where:{id:meeting.id}, data:{ status:"ENDED", startedAt, endedAt, providerStatus:"ended", providerSyncedAt:new Date() } });
  await prisma.meetingEvent.upsert({ where:{eventKey:`zoom-ended:${meeting.id}`}, update:{}, create:{ workspaceId:meeting.workspaceId, meetingId:meeting.id, type:"ROOM_ENDED", eventKey:`zoom-ended:${meeting.id}`, occurredAt:endedAt, metadata:toPrismaJson({provider:"ZOOM", providerMeetingId}) } });
  await audit(meeting.workspaceId,"zoom.meeting_ended","MeetingRoom",meeting.id,undefined,{providerMeetingId});
  return updated;
}
