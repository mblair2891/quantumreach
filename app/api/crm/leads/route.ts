import { NextResponse } from "next/server";
import { createLead } from "@/lib/crm/service";
export async function POST(request: Request) { const body = await request.json(); const record = await createLead(String(body.workspaceId), body); return NextResponse.json(record, { status: 201 }); }
