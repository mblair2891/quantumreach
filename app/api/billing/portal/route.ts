import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { requireBillingConfigured } from "@/lib/billing/config";

export async function POST() {
  const user = await requireUserProfile();
  const billing = requireBillingConfigured();
  if (!billing.ok) return NextResponse.json({ error: billing.message }, { status: billing.status });
  const link = await prisma.stripeCustomerLink.findUnique({ where: { userId: user.id } });
  if (!link) return NextResponse.json({ error: "No Stripe billing customer is linked to this account." }, { status: 404 });
  const base = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try { const { createPortal } = await import("@/lib/stripe/commerce"); return NextResponse.json(await createPortal(link.stripeCustomerId, `${base}/dashboard`)); } catch { return NextResponse.json({ error: "Unable to open the billing portal." }, { status: 502 }); }
}
