import { NextResponse } from "next/server";
import { z } from "zod";
import { runAnalyzer } from "@/lib/ai/orchestration";
const schema = z.object({ workspaceId: z.string(), analyzerKey: z.enum(["diagnostic_summary", "constraint_extraction", "roi_model", "executive_report", "strategic_roadmap"]), input: z.record(z.unknown()) });
export async function POST(request: Request) { const parsed = schema.parse(await request.json()); const record = await runAnalyzer(parsed.workspaceId, parsed.analyzerKey, parsed.input); return NextResponse.json(record, { status: 201 }); }
