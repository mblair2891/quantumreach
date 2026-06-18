import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { toPrismaJson } from "@/lib/db/json";
import { audit } from "@/lib/audit/service";
import { mimeFromZoomFileType } from "@/lib/meetings/recording-files";
import { computeZoomValidationToken, verifyZoomWebhookSignature, zoomEventId } from "@/lib/meetings/providers/zoom";

type ZoomPayload = { event?: string; event_ts?: number; payload?: { plainToken?: string; object?: { id?: string | number; uuid?: string; recording_files?: ZoomFile[]; recording_file?: ZoomFile } } };
type ZoomFile = { id?: string; file_id?: string; recording_type?: string; file_type?: string; file_size?: number; recording_start?: string; recording_end?: string; status?: string };
function meetingId(payload: ZoomPayload) { return String(payload.payload?.object?.id || payload.payload?.object?.uuid || ""); }
function files(payload: ZoomPayload): ZoomFile[] { return payload.payload?.object?.recording_files || (payload.payload?.object?.recording_file ? [payload.payload.object.recording_file] : []); }
async function resolveMeeting(providerMeetingId:string) { return prisma.meetingRoom.findFirst({ where:{ provider:"ZOOM", providerMeetingId }, include:{ MeetingRecording:true } }); }

export async function POST(request: Request) {
  const raw = await request.text();
  let payload: ZoomPayload; try { payload = JSON.parse(raw) as ZoomPayload; } catch { return NextResponse.json({ error:"Invalid JSON" }, { status:400 }); }
  if (payload?.event === "endpoint.url_validation") return NextResponse.json({ plainToken: payload.payload?.plainToken, encryptedToken: computeZoomValidationToken(payload.payload?.plainToken || "") });
  if (!verifyZoomWebhookSignature(raw, request.headers.get("x-zm-request-timestamp"), request.headers.get("x-zm-signature"))) return NextResponse.json({ error:"Invalid Zoom signature" }, { status:401 });
  const providerEventId = zoomEventId(payload, raw);
  const providerMeetingId = meetingId(payload);
  const event = await prisma.providerWebhookEvent.upsert({ where:{provider_providerEventId:{provider:"ZOOM",providerEventId}}, update:{}, create:{provider:"ZOOM",providerEventId,eventType:String(payload.event||"unknown"),providerMeetingId} });
  if (event.processedAt) return NextResponse.json({ ok:true, duplicate:true });
  const meeting = providerMeetingId ? await resolveMeeting(providerMeetingId) : null;
  if (!meeting) { await prisma.providerWebhookEvent.update({where:{id:event.id}, data:{status:"IGNORED", processedAt:new Date(), safeFailureMessage:"No matching Zoom meeting."}}); return NextResponse.json({ ok:true, ignored:true }); }
  const type = String(payload.event || "");
  if (["meeting.ended", "meeting_ended"].includes(type)) {
    await prisma.meetingRoom.update({ where:{id:meeting.id}, data:{ status:"ENDED", endedAt:new Date(), providerStatus:"ended", providerSyncedAt:new Date() } });
    await audit(meeting.workspaceId,"zoom.meeting_ended","MeetingRoom",meeting.id,undefined,{providerMeetingId});
  }
  if (["recording.completed", "recording.completed.all", "recording.transcript_completed", "recording.transcript.completed"].includes(type)) {
    for (const f of files(payload)) {
      const artifactId = String(f.id || f.file_id || `${providerMeetingId}:${f.recording_type}:${f.file_type}`);
      const artifact = await prisma.meetingProviderArtifact.upsert({ where:{workspaceId_provider_providerArtifactId:{workspaceId:meeting.workspaceId,provider:"ZOOM",providerArtifactId:artifactId}}, update:{ status:"DISCOVERED", providerDownloadState:f.status || "completed" }, create:{ workspaceId:meeting.workspaceId, meetingRoomId:meeting.id, provider:"ZOOM", providerArtifactId:artifactId, providerMeetingId, recordingType:f.recording_type, fileType:f.file_type, mimeType:mimeFromZoomFileType(f.file_type), fileSizeBytes:f.file_size?BigInt(f.file_size):undefined, startedAt:f.recording_start?new Date(f.recording_start):undefined, endedAt:f.recording_end?new Date(f.recording_end):undefined, status:"DISCOVERED", providerDownloadState:f.status || "completed", safeMetadata:toPrismaJson({ source:"zoom_webhook" }) } });
      await audit(meeting.workspaceId, type.includes("transcript") ? "zoom.recording_artifact_discovered" : "zoom.recording_artifact_discovered", "MeetingRoom", meeting.id, undefined, { artifactId: artifact.id, providerArtifactId: artifact.providerArtifactId, fileType: artifact.fileType });
    }
  }
  await prisma.providerWebhookEvent.update({ where:{id:event.id}, data:{workspaceId:meeting.workspaceId,status:"PROCESSED",processedAt:new Date()} });
  return NextResponse.json({ ok:true });
}
