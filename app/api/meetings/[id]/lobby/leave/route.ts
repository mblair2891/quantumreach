import { NextResponse } from "next/server";
import { leaveLobby } from "@/lib/meetings/lobby";
import { safeMeetingError } from "@/lib/meetings/errors";
export async function POST(request:Request,{params}:{params:{id:string}}){ try{ const body=await request.json().catch(()=>({})); return NextResponse.json(await leaveLobby({meetingId:params.id,invitationToken:body.invitationToken,displayName:body.displayName})); }catch(error){ return NextResponse.json({error:safeMeetingError(error,"Lobby could not be left.")},{status:403}); }}
