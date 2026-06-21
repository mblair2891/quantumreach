import { NextResponse } from "next/server";
export async function POST(req: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ ok: false, message: "Stripe webhook is not configured." }, { status: 503 });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ ok: false }, { status: 401 });
  await req.text();
  return NextResponse.json({ ok: true, message: "Stripe signature header accepted for configured webhook processing foundation." });
}
