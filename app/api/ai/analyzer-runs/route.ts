import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { runAnalyzer } from "@/lib/ai/orchestration";
import { checkInMemoryRateLimit } from "@/lib/rate-limit";

const schema = z.object({ workspaceId: z.string(), analyzerKey: z.enum(["diagnostic_summary", "constraint_extraction", "roi_model", "executive_report", "strategic_roadmap"]), input: z.record(z.unknown()) });

export async function POST(request: NextRequest) {
  const rateLimit = checkInMemoryRateLimit(`ai:${request.headers.get("x-forwarded-for") ?? "local"}`, 20, 60_000);
  if (!rateLimit.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  const parsed = schema.parse(await request.json());
  const record = await runAnalyzer(parsed.workspaceId, parsed.analyzerKey, parsed.input);
  return NextResponse.json(record, { status: 201 });
}
