import { NextResponse } from "next/server";
import { handleSesEvent } from "@/lib/revenue-os/email";
export async function POST(req: Request) {
  if (!process.env.AWS_SES_BOUNCE_WEBHOOK_SECRET && !process.env.AWS_SES_COMPLAINT_WEBHOOK_SECRET) return NextResponse.json({ ok: false, message: "AWS SES webhook is disabled until webhook secrets/signature verification are configured." }, { status: 503 });
  const secret = req.headers.get("x-quantumreach-ses-secret");
  if (secret !== process.env.AWS_SES_BOUNCE_WEBHOOK_SECRET && secret !== process.env.AWS_SES_COMPLAINT_WEBHOOK_SECRET) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const workspaceId = String(body.workspaceId || ""); const email = String(body.email || ""); const type = body.type === "complaint" ? "complaint" : "bounce";
  if (!workspaceId || !email) return NextResponse.json({ ok: false }, { status: 400 });
  await handleSesEvent({ workspaceId, email, type, messageId: body.messageId });
  return NextResponse.json({ ok: true });
}
