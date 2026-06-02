import { NextResponse } from "next/server";
import { createCompany } from "@/lib/crm/service";
export async function POST(request: Request) { const body = await request.json(); const record = await createCompany(String(body.workspaceId), body); return NextResponse.json(record, { status: 201 }); }
