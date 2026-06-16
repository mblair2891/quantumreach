import { NextResponse } from "next/server";
import { admitLobbyEntry } from "@/lib/meetings/lobby";
import { safeMeetingError } from "@/lib/meetings/errors";
export async function POST(request:Request,{params}:{params:{id:string;entryId:string}}){ try{ const body=await request.json().catch(()=>({})); return NextResponse.json(await admitLobbyEntry(params.id,params.entryId,body.displayName)); }catch(error){ return NextResponse.json({error:safeMeetingError(error,"Participant could not be admitted.")},{status:403}); }}
