import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { trackFunnelEvent } from "@/lib/customer-journey/funnel";

const allowed = new Set(["START_PAGE_VIEW", "VSL_STARTED", "VSL_COMPLETED", "JOIN_CTA_CLICKED"]);
export async function POST(request: NextRequest) {
  const { eventType } = await request.json();
  if (!allowed.has(eventType)) return NextResponse.json({ error: "Unsupported event" }, { status: 400 });
  const anonymousId = cookies().get("qr_acquisition")?.value;
  const session = anonymousId ? await prisma.acquisitionSession.findUnique({ where: { anonymousId } }) : null;
  await trackFunnelEvent(eventType, { acquisitionSessionId: session?.id });
  return NextResponse.json({ ok: true });
}
