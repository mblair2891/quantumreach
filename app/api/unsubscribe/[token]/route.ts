import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/revenue-os/email";
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const result = await unsubscribeByToken(params.token);
  if (!result) return NextResponse.json({ ok: false, message: "Unsubscribe link is invalid or expired." }, { status: 404 });
  return NextResponse.json({ ok: true, message: "You have been unsubscribed. Quantum Reach will suppress future outreach to this address." });
}
export async function POST(req: Request, ctx: { params: { token: string } }) { return GET(req, ctx); }
