import { NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";
import { requireBillingConfigured } from "@/lib/billing/config";

export async function POST() {
  await requireWorkspaceAccess();
  const billing = requireBillingConfigured();
  if (!billing.ok) return NextResponse.json({ error: billing.message }, { status: billing.status });
  return NextResponse.json({ error: "Stripe customer portal wiring is ready, but the Stripe SDK is intentionally deferred until billing is enabled for private beta." }, { status: 501 });
}
