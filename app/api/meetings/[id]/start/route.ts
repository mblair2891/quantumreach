import { NextResponse } from "next/server";
import { getZoomStartUrl } from "@/lib/meetings/service";
export async function GET(request: Request, { params }: { params: { id: string } }) { try { const workspaceId = new URL(request.url).searchParams.get("workspaceId") || ""; return NextResponse.redirect(await getZoomStartUrl(workspaceId, params.id)); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Unable to start meeting." }, { status: 400 }); } }
