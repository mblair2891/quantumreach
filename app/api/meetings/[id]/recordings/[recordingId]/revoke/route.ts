import { NextResponse } from "next/server";
import { revokeRecordingConsent, safeRecordingError } from "@/lib/meetings/recordings";
export const runtime="nodejs";
export async function POST(request:Request,{params}:{params:{id:string;recordingId:string}}){ try{ const body=await request.json() as {invitationToken?:string;displayName?:string}; await revokeRecordingConsent(params.id,{...body,recordingId:params.recordingId}); return NextResponse.json({ok:true});}catch(e){return NextResponse.json({error:safeRecordingError(e)},{status:400});}}
