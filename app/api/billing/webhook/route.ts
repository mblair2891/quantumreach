import { NextResponse } from "next/server";
import { processStripeEvent } from "@/lib/stripe/webhooks";
import { verifyStripeSignature } from "@/lib/stripe/client";
export async function POST(req: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ ok: false, message: "Stripe webhook is not configured." }, { status: 503 });
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"))) return NextResponse.json({ ok: false }, { status: 400 });
  try { await processStripeEvent(JSON.parse(payload)); return NextResponse.json({ ok: true }); } catch { return NextResponse.json({ ok: false }, { status: 500 }); }
}
