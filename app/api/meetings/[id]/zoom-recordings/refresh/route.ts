import { NextResponse } from "next/server";
import { refreshZoomRecordingArtifacts } from "@/lib/meetings/recording-workflow";
export async function POST(request:Request,{params}:{params:{id:string}}){try{const workspaceId=new URL(request.url).searchParams.get("workspaceId")||""; return NextResponse.json(await refreshZoomRecordingArtifacts(workspaceId,params.id));}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Zoom recording status could not be checked."},{status:400});}}
