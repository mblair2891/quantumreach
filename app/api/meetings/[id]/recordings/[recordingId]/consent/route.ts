import { NextResponse } from "next/server";
import { respondToRecordingConsent, safeRecordingError } from "@/lib/meetings/recordings";
export const runtime="nodejs";
export async function POST(request:Request,{params}:{params:{id:string;recordingId:string}}){ try{ const body=await request.json() as {invitationToken?:string;displayName?:string;consent:boolean}; return NextResponse.json({consent:await respondToRecordingConsent(params.id,{...body,recordingId:params.recordingId})});}catch(e){return NextResponse.json({error:safeRecordingError(e)},{status:400});}}
