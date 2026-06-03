import { NextResponse } from "next/server";
import { createDiagnosticSession } from "@/lib/diagnostics/service";
export async function POST(request: Request) { const body = await request.json(); const record = await createDiagnosticSession(String(body.workspaceId), body); return NextResponse.json(record, { status: 201 }); }
