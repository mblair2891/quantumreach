import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOptionalUserProfile } from "@/lib/auth/rbac";
import { requireBillingConfigured } from "@/lib/billing/config";
import { prisma } from "@/lib/db/prisma";
import { acquisitionCookie } from "@/lib/customer-journey/acquisition-draft";

export async function POST(req: Request) {
  const billing = requireBillingConfigured();
  if (!billing.ok) return NextResponse.json({ error: billing.message }, { status: billing.status });
  const body = await req.json().catch(() => ({}));
  if (typeof body.orderId !== "string") return NextResponse.json({ error: "An order is required." }, { status: 400 });

  const user = await getOptionalUserProfile();
  const anonymousId = cookies().get(acquisitionCookie)?.value;
  const session = anonymousId
    ? await prisma.acquisitionSession.findUnique({ where: { anonymousId }, select: { id: true } })
    : null;

  try {
    const { createCheckout } = await import("@/lib/stripe/commerce");
    return NextResponse.json(await createCheckout(body.orderId, {
      id: user?.id ?? null,
      email: user?.email ?? null,
      acquisitionSessionId: session?.id ?? null,
    }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start checkout." }, { status: 422 });
  }
}
