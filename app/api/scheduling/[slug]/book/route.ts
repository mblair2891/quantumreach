import { NextResponse } from "next/server";
import { createPublicBooking } from "@/lib/revenue-os/scheduling";
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const body = await req.json();
  const booking = await createPublicBooking(params.slug, { name: body.name, email: body.email, company: body.company, phone: body.phone, notes: body.notes, startsAt: new Date(body.startsAt), durationMinutes: body.durationMinutes, tokenContext: body.tokenContext });
  return NextResponse.json({ ok: true, bookingId: booking.id, zoomJoinUrl: booking.zoomJoinUrl ?? null, message: booking.zoomJoinUrl ? "Booking confirmed." : "Booking confirmed. Zoom is not connected for this scheduling page, so a manual meeting fallback is required." });
}
