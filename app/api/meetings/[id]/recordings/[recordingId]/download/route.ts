import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit/service";
import { getMeetingRecordingObject, headMeetingRecordingObject } from "@/lib/storage/meeting-recordings";
function safeName(name?:string|null){return (name||"recording.mp4").replace(/[\r\n"\\/]/g,"-").slice(0,120)}
export async function GET(request:Request,{params}:{params:{id:string;recordingId:string}}){
  const workspaceId=new URL(request.url).searchParams.get("workspaceId")||"";
  const {user}=await requireWorkspaceAccess(workspaceId);
  const r=await prisma.meetingRecording.findFirst({where:{id:params.recordingId,workspaceId,meetingRoomId:params.id}});
  if(!r) return NextResponse.json({error:"Recording was not found."},{status:404});
  if(r.status!=="AVAILABLE"||r.importStatus==="FAILED"||r.importStatus==="CANCELLED") return NextResponse.json({error:"Recording is not available for download yet."},{status:409});
  if(!r.storageKey) return NextResponse.json({error:"The recording file is no longer available in storage."},{status:404});
  try{
    await headMeetingRecordingObject(r.storageKey);
    const upstream=await getMeetingRecordingObject(r.storageKey, request.headers.get("range")||undefined);
    await audit(workspaceId,"recording_downloaded","MeetingRecording",r.id,user.id,{meetingId:params.id,fileSizeBytes:r.fileSizeBytes?.toString(),source:r.source});
    return new Response(upstream.body,{status:upstream.status,headers:{"Content-Type":r.mimeType||"application/octet-stream","Content-Disposition":`attachment; filename="${safeName(r.fileName||r.originalFileName)}"`,"Accept-Ranges":"bytes",...(upstream.headers.get("content-range")?{"Content-Range":upstream.headers.get("content-range")!}:{}),...(upstream.headers.get("content-length")?{"Content-Length":upstream.headers.get("content-length")!}:{})}});
  }catch{
    return NextResponse.json({error:"The recording file is no longer available in storage."},{status:404});
  }
}
