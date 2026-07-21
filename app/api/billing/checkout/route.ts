import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/rbac";
import { requireBillingConfigured } from "@/lib/billing/config";

export async function POST(req: Request) {
  const user = await requireUserProfile();
  const billing = requireBillingConfigured();
  if (!billing.ok) return NextResponse.json({ error: billing.message }, { status: billing.status });
  const body = await req.json().catch(() => ({}));
  if (typeof body.orderId !== "string") return NextResponse.json({ error: "An order is required." }, { status: 400 });
  try { const { createCheckout } = await import("@/lib/stripe/commerce"); return NextResponse.json(await createCheckout(body.orderId, user)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start checkout." }, { status: 422 }); }
}
