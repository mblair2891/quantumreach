import { NextResponse } from "next/server";
import { recoverStaleInfrastructureJobs, runInfrastructureJobs } from "@/lib/jobs/service";

function authorized(request: Request) {
  const secret = process.env.JOB_RUNNER_SECRET || process.env.CRON_SECRET;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-job-runner-secret");
  return Boolean(secret && token && token === secret);
}
export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { limit?: number };
  const stale = await recoverStaleInfrastructureJobs();
  const summary = await runInfrastructureJobs({ workerId: `internal:${crypto.randomUUID()}`, limit: body.limit });
  console.info(JSON.stringify({ event: "infrastructure_jobs_run", staleRecovered: stale.count, ...summary }));
  return NextResponse.json({ ok: true, staleRecovered: stale.count, ...summary });
}
export async function GET(request: Request) { return POST(request); }
