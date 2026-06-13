import { NextResponse } from "next/server";
import { markParticipantLeft } from "@/lib/meetings/service";
export async function POST(req: Request) { try { const body = await req.json(); if (body.type === "left" && body.participantId) await markParticipantLeft(body.participantId); return NextResponse.json({ ok: true }); } catch { return NextResponse.json({ error: "Unable to record meeting event." }, { status: 400 }); } }
