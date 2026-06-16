import { NextResponse } from "next/server";
import { requestLobbyEntry } from "@/lib/meetings/lobby";
import { safeMeetingError } from "@/lib/meetings/errors";
export async function POST(request:Request,{params}:{params:{id:string}}){ try{ const body=await request.json().catch(()=>({})); return NextResponse.json(await requestLobbyEntry({meetingId:params.id,invitationToken:body.invitationToken,displayName:body.displayName})); }catch(error){ return NextResponse.json({error:safeMeetingError(error,"Lobby access could not be requested.")},{status:403}); }}
