import { NextResponse } from "next/server";
import { getZoomJoinUrl } from "@/lib/meetings/service";
export async function GET(request: Request, { params }: { params: { id: string } }) { try { const url = new URL(request.url); const joinUrl = await getZoomJoinUrl(params.id, url.searchParams.get("invitationToken") || url.searchParams.get("credential") || undefined, url.searchParams.get("displayName") || undefined); return NextResponse.redirect(joinUrl); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Unable to join meeting." }, { status: 400 }); } }
