import { NextResponse } from "next/server";
import { startRecording, safeRecordingError } from "@/lib/meetings/recordings";
export const runtime="nodejs";
export async function POST(request:Request,{params}:{params:{id:string;recordingId:string}}){ try{ const body=await request.json() as {workspaceId:string}; return NextResponse.json({recording:await startRecording(body.workspaceId,params.id,params.recordingId)});}catch(e){return NextResponse.json({error:safeRecordingError(e)},{status:400});}}
