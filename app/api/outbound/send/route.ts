import { NextResponse } from "next/server";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { prisma } from "@/lib/db/prisma";
import { stubSend } from "@/lib/outbound/service";

export async function POST(req: Request) {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  const body = await req.json().catch(() => ({}));
  if (typeof body.inboxId !== "string" || typeof body.toEmail !== "string") {
    return NextResponse.json({ error: "inboxId and toEmail are required." }, { status: 400 });
  }
  const inbox = await prisma.inbox.findFirst({ where: { id: body.inboxId, workspaceId: workspace.id } });
  if (!inbox) return NextResponse.json({ error: "Inbox was not found." }, { status: 404 });
  const result = await stubSend({
    inboxId: inbox.id,
    toEmail: body.toEmail,
    contactId: typeof body.contactId === "string" ? body.contactId : null,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
