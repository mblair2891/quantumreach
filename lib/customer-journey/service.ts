import { prisma } from "@/lib/db/prisma";
import { SetupPriority } from "@prisma/client";

export const priorityRank: Record<SetupPriority, number> = { EXPEDITED: 0, PRIORITY: 1, STANDARD: 2, MANUAL_HOLD: 3 };
export const requiredSetupTasks = [
  ["BUSINESS_PROFILE", "Complete your business profile"],
  ["REGISTRANT_PROFILE", "Complete your domain registrant profile"],
  ["DOMAIN_SELECTION", "Choose your sending domains"],
  ["SENDER_PREFERENCES", "Confirm sender names"],
  ["COMPLIANCE", "Acknowledge the outreach compliance policy"],
] as const;

export async function recordAcquisition(input: { anonymousId?: string; userId?: string; landingPage: string; source?: string; medium?: string; campaign?: string; content?: string; term?: string; affiliateAttributionId?: string }) {
  const { anonymousId, ...data } = input;
  return anonymousId ? prisma.acquisitionSession.upsert({ where: { anonymousId }, create: { anonymousId, ...data }, update: data }) : prisma.acquisitionSession.create({ data });
}

/** Creates a truthful, unpaid manual order. Only an operator may verify payment later. */
export async function createInfrastructureOrder(input: { userId: string; productKey: string; priority?: SetupPriority; programEnrollmentId?: string; acquisitionSessionId?: string; affiliateAttributionId?: string }) {
  const priority = input.priority ?? "STANDARD";
  return prisma.$transaction(async (tx) => {
    const order = await tx.customerOrder.create({ data: { userId: input.userId, programEnrollmentId: input.programEnrollmentId, acquisitionSessionId: input.acquisitionSessionId, affiliateAttributionId: input.affiliateAttributionId, setupPriority: priority, status: "CHECKOUT_PENDING", paymentStatus: "UNPAID", paymentMethod: "MANUAL", items: { create: [{ itemType: "SENDING_PACKAGE", metadata: { productKey: input.productKey } }, ...(priority === "STANDARD" ? [] : [{ itemType: "SETUP_PRIORITY", metadata: { priority } }]) ] } } });
    const infrastructureOrder = await tx.infrastructureOrder.create({ data: { customerOrderId: order.id, selectedProductKey: input.productKey, priority, status: "WAITING_ON_CUSTOMER", currentStage: "Required setup information", customerActionRequired: true, tasks: { create: requiredSetupTasks.map(([taskType, title]) => ({ taskType, title })) }, operatorTasks: { create: { taskType: "DOMAIN_REVIEW", title: "Review domain and provider readiness", priority } } } });
    return { order, infrastructureOrder };
  });
}

export async function completeCustomerTask(userId: string, taskId: string) {
  const task = await prisma.customerSetupTask.findFirst({ where: { id: taskId, order: { order: { userId } } } });
  if (!task) throw new Error("Setup task was not found.");
  return prisma.customerSetupTask.update({ where: { id: taskId }, data: { status: "COMPLETED", completedAt: new Date() } });
}

export async function getQueue() { return prisma.infrastructureOrder.findMany({ include: { order: { include: { items: true } }, tasks: true }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] }); }
export async function readyForWorkspace(orderId: string) {
  const order = await prisma.infrastructureOrder.findUnique({ where: { id: orderId }, include: { tasks: true, order: true } });
  if (!order) return false;
  return order.order.paymentStatus === "PAID" && order.tasks.filter((task) => task.required).every((task) => ["COMPLETED", "WAIVED"].includes(task.status)) && !order.blockedReason;
}
