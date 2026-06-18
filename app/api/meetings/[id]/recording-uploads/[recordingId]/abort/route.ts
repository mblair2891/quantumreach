import { NextResponse } from "next/server";
import { abortLocalRecordingUpload } from "@/lib/meetings/recording-workflow";
export async function POST(request:Request,{params}:{params:{id:string;recordingId:string}}){try{const workspaceId=new URL(request.url).searchParams.get("workspaceId")||""; return NextResponse.json(await abortLocalRecordingUpload(workspaceId,params.id,params.recordingId));}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Upload could not be aborted."},{status:400});}}
