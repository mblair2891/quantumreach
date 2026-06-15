import { NextResponse } from "next/server";
import { requestRecordingConsent, listMeetingRecordings, safeRecordingError } from "@/lib/meetings/recordings";
export const runtime="nodejs";
export async function GET(_:Request,{params}:{params:{id:string}}){ try{ const workspaceId=new URL(_.url).searchParams.get("workspaceId")||""; return NextResponse.json({recordings:await listMeetingRecordings(workspaceId,params.id)});}catch(e){return NextResponse.json({error:safeRecordingError(e)},{status:400});}}
export async function POST(request:Request,{params}:{params:{id:string}}){ try{ const body=await request.json() as {workspaceId:string}; return NextResponse.json({recording:await requestRecordingConsent(body.workspaceId,params.id)});}catch(e){return NextResponse.json({error:safeRecordingError(e)},{status:400});}}
