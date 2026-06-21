/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
import { createToken } from "./email";
export async function createPublicBooking(slug: string, input: { name: string; email: string; company?: string; phone?: string; notes?: string; startsAt: Date; durationMinutes?: number; tokenContext?: { campaignId?: string; contactId?: string; opportunityId?: string } }) {
  const page = await (prisma as any).schedulingPage.findUnique({ where: { slug } });
  if (!page || page.status !== "ACTIVE") throw new Error("Scheduling page unavailable.");
  const startsAt = new Date(input.startsAt); const endsAt = new Date(startsAt.getTime() + (input.durationMinutes ?? page.durationMinutes) * 60000);
  const conflicts = await (prisma as any).booking.count({ where: { workspaceId: page.workspaceId, schedulingPageId: page.id, status: { in: ["SCHEDULED", "RESCHEDULED"] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } });
  if (conflicts) throw new Error("Selected slot is unavailable.");
  let company = null;
  if (input.company) company = await (prisma as any).company.create({ data: { workspaceId: page.workspaceId, name: input.company } }).catch(() => null);
  const [firstName, ...rest] = input.name.split(" ");
  const contact = input.tokenContext?.contactId ? await (prisma as any).contact.findFirst({ where: { id: input.tokenContext.contactId, workspaceId: page.workspaceId } }) : await (prisma as any).contact.create({ data: { workspaceId: page.workspaceId, firstName: firstName || "Guest", lastName: rest.join(" ") || "Contact", email: input.email.toLowerCase(), phone: input.phone, companyId: company?.id } });
  const booking = await (prisma as any).booking.create({ data: { workspaceId: page.workspaceId, schedulingPageId: page.id, contactId: contact?.id, companyId: company?.id, opportunityId: input.tokenContext?.opportunityId, campaignId: input.tokenContext?.campaignId, token: createToken(), name: input.name, email: input.email.toLowerCase(), companyName: input.company, phone: input.phone, notes: input.notes, startsAt, endsAt, status: "SCHEDULED" } });
  await (prisma as any).activity.create({ data: { workspaceId: page.workspaceId, type: "booking.created", title: "Booking created", relatedType: "Booking", relatedId: booking.id } }).catch(() => null);
  return booking;
}
