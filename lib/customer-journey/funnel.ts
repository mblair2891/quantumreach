import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export type CustomerFunnelState = "VISITOR" | "PROGRAM_NOT_STARTED" | "PROGRAM_PENDING" | "PROGRAM_ACTIVE" | "INFRASTRUCTURE_NOT_SELECTED" | "INFRASTRUCTURE_SELECTED" | "PRIORITY_NOT_SELECTED" | "ORDER_PENDING_PAYMENT" | "SETUP_QUEUED" | "SETUP_IN_PROGRESS" | "READY";

export async function trackFunnelEvent(eventType: string, input: { userId?: string; acquisitionSessionId?: string; customerOrderId?: string; metadata?: Record<string, unknown> } = {}) {
  return prisma.funnelEvent.create({ data: { eventType, ...input, metadata: (input.metadata ?? {}) as Prisma.InputJsonValue } });
}

export async function getCustomerFunnelState(userId: string): Promise<CustomerFunnelState> {
  const enrollment = await prisma.programEnrollment.findFirst({ where: { userId }, orderBy: { enrolledAt: "desc" } });
  if (!enrollment) return "PROGRAM_NOT_STARTED";
  const infrastructure = await prisma.infrastructureOrder.findFirst({ where: { order: { userId } }, include: { order: true }, orderBy: { createdAt: "desc" } });
  if (!infrastructure) return enrollment.status === "ACTIVE" ? "INFRASTRUCTURE_NOT_SELECTED" : "PROGRAM_PENDING";
  if (infrastructure.status === "READY") return "READY";
  if (["QUEUED", "WAITING_ON_CUSTOMER", "WAITING_ON_PROVIDER"].includes(infrastructure.status)) return "SETUP_QUEUED";
  if (infrastructure.status === "IN_PROGRESS") return "SETUP_IN_PROGRESS";
  return infrastructure.order.paymentStatus === "PAID" ? "INFRASTRUCTURE_SELECTED" : "ORDER_PENDING_PAYMENT";
}

export async function getCustomerFunnelDestination(userId: string) {
  const state = await getCustomerFunnelState(userId);
  if (["PROGRAM_NOT_STARTED", "PROGRAM_PENDING"].includes(state)) return "/join";
  if (state === "INFRASTRUCTURE_NOT_SELECTED") return "/setup/infrastructure";
  if (["INFRASTRUCTURE_SELECTED", "PRIORITY_NOT_SELECTED", "ORDER_PENDING_PAYMENT"].includes(state)) return "/setup/priority";
  return state === "READY" ? "/setup/status" : "/setup/confirmation";
}
