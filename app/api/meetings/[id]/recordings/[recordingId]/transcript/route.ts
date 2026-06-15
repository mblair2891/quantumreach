import { NextResponse } from "next/server";
import { approveTranscript, saveTranscriptDraft } from "@/lib/meetings/transcription";
import { safeRecordingError } from "@/lib/meetings/recordings";
export const runtime="nodejs";
export async function POST(request:Request,{params}:{params:{id:string;recordingId:string}}){ try{ const body=await request.json() as {workspaceId:string; text?:string; action:"save"|"approve"}; const result=body.action==="approve"?await approveTranscript(body.workspaceId,params.id,params.recordingId):await saveTranscriptDraft(body.workspaceId,params.id,params.recordingId,body.text||""); return NextResponse.json({recording:result});}catch(e){return NextResponse.json({error:safeRecordingError(e)},{status:400});}}
