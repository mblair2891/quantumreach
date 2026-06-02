import { NextResponse } from "next/server";
import { createContact } from "@/lib/crm/service";
export async function POST(request: Request) { const body = await request.json(); const record = await createContact(String(body.workspaceId), body); return NextResponse.json(record, { status: 201 }); }
