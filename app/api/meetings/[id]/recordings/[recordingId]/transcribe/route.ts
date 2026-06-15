import { NextResponse } from "next/server";
import { processTranscriptionJob, queueTranscription } from "@/lib/meetings/transcription";
import { safeRecordingError } from "@/lib/meetings/recordings";
export const runtime="nodejs";
export async function POST(request:Request,{params}:{params:{id:string;recordingId:string}}){ try{ const body=await request.json() as {workspaceId:string; queueOnly?:boolean}; const result=body.queueOnly?await queueTranscription(body.workspaceId,params.id,params.recordingId):await processTranscriptionJob(body.workspaceId,params.id,params.recordingId); return NextResponse.json({result}); }catch(e){return NextResponse.json({error:safeRecordingError(e)},{status:400});}}
