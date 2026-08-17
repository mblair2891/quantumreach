import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { handleSesEvent } from "@/lib/revenue-os/email";
import { cascadeDomainPause } from "@/lib/sending-infrastructure/warmup-service";

function authorized(req: Request) {
  if (!process.env.AWS_SES_BOUNCE_WEBHOOK_SECRET && !process.env.AWS_SES_COMPLAINT_WEBHOOK_SECRET) return false;
  const secret = req.headers.get("x-quantumreach-ses-secret");
  return secret === process.env.AWS_SES_BOUNCE_WEBHOOK_SECRET || secret === process.env.AWS_SES_COMPLAINT_WEBHOOK_SECRET;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    if (!process.env.AWS_SES_BOUNCE_WEBHOOK_SECRET && !process.env.AWS_SES_COMPLAINT_WEBHOOK_SECRET) {
      return NextResponse.json({ ok: false, message: "AWS SES webhook is disabled until webhook secrets are configured." }, { status: 503 });
    }
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (body.Type === "SubscriptionConfirmation" && typeof body.SubscribeURL === "string") {
    return NextResponse.json({ ok: true, confirm: true });
  }

  const message = typeof body.Message === "string" ? JSON.parse(body.Message) as Record<string, unknown> : body;
  const type = message.notificationType === "Complaint" || body.type === "complaint" ? "complaint" : "bounce";
  const email =
    String(body.email || "") ||
    String((message.mail as { destination?: string[] } | undefined)?.destination?.[0] || "") ||
    String((message.bounce as { bouncedRecipients?: Array<{ emailAddress?: string }> } | undefined)?.bouncedRecipients?.[0]?.emailAddress || "") ||
    String((message.complaint as { complainedRecipients?: Array<{ emailAddress?: string }> } | undefined)?.complainedRecipients?.[0]?.emailAddress || "");
  const messageId = String(body.messageId || (message.mail as { messageId?: string } | undefined)?.messageId || "");
  if (!email) return NextResponse.json({ ok: false }, { status: 400 });

  const ledger = messageId
    ? await prisma.outboundMessageLedger.findFirst({ where: { OR: [{ providerMessageId: messageId }, { messageId }] } })
    : null;
  const workspaceId = String(body.workspaceId || ledger?.workspaceId || "");
  if (!workspaceId) return NextResponse.json({ ok: false, message: "workspaceId could not be resolved." }, { status: 400 });

  await handleSesEvent({ workspaceId, email: email.toLowerCase(), type, messageId: messageId || undefined });
  if (ledger) {
    await prisma.outboundMessageLedger.update({
      where: { id: ledger.id },
      data: type === "complaint"
        ? { complainedAt: new Date(), status: "COMPLAINED" }
        : { bouncedAt: new Date(), status: "BOUNCED", failureCode: "HARD_BOUNCE" },
    }).catch(() => undefined);
  }

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const [sent, bounced] = await Promise.all([
    prisma.outboundMessageLedger.count({ where: { workspaceId, sentAt: { gte: dayStart } } }),
    prisma.outboundMessageLedger.count({ where: { workspaceId, bouncedAt: { gte: dayStart } } }),
  ]);
  if (sent >= 10 && bounced / sent >= 0.05 && ledger?.managedDomainId) {
    await cascadeDomainPause({ workspaceId, domainId: ledger.managedDomainId, reason: "Automated pause: bounce rate exceeded 5% today." });
  }

  console.info(JSON.stringify({ event: "ses_webhook", workspaceId, type, messageId: messageId || null }));
  return NextResponse.json({ ok: true });
}
