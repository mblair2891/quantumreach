import { NextResponse } from "next/server";
import { createOpportunity } from "@/lib/crm/service";
export async function POST(request: Request) { const body = await request.json(); const record = await createOpportunity(String(body.workspaceId), body); return NextResponse.json(record, { status: 201 }); }
