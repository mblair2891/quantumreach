import "./server-only";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { simulateSuccessfulPayment } from "@/lib/simulated-payment/service";
import { resolveAffiliateCode } from "@/lib/affiliates/service";

const timeout = 30_000;
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
let userId = "", orderId = "", infrastructureId = "", productId = "", workspaceId = "", participantId = "";
const priorVercelEnvironment = process.env.VERCEL_ENV;

beforeAll(async () => {
  process.env.VERCEL_ENV = "preview";
  const user = await prisma.userProfile.create({ data: { clerkUserId: `simulated-${suffix}`, email: `simulated-${suffix}@example.test`, firstName: "Preview", lastName: "Subscriber" } });
  userId = user.id;
  const product = await prisma.commerceProduct.create({ data: { key: `SIMULATED_PACKAGE_${suffix}`, name: "Simulated package", category: "SENDING_PACKAGE", active: true, recurring: true, billingInterval: "MONTH", metadata: { version: 1, slug: `simulated-${suffix}`, recurringPriceCents: 29700, setupFeeCents: 75000, effectiveAt: "2026-08-03T00:00:00.000Z" } } });
  productId = product.id;
  const order = await prisma.customerOrder.create({ data: { userId, status: "CHECKOUT_PENDING", paymentStatus: "UNPAID", paymentMethod: "MANUAL", setupPriority: "STANDARD", acceptedCommercialTerms: { planName: "Simulated package", recurringPriceCents: 29700, setupPriceCents: 75000 }, acceptedCouponSnapshot: { todayTotalCents: 89040, coupon: { trialDays: 14, normalizedCode: "PREVIEW20" } }, items: { create: { commerceProductId: productId, itemType: "SENDING_PACKAGE", metadata: { productKey: product.key } } } } });
  orderId = order.id;
  const infrastructure = await prisma.infrastructureOrder.create({ data: { customerOrderId: orderId, selectedProductKey: product.key, priority: "STANDARD", status: "PENDING", currentStage: "Waiting for payment verification" } });
  infrastructureId = infrastructure.id;
});

afterAll(async () => {
  if (priorVercelEnvironment === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = priorVercelEnvironment;
  if (participantId) { const memberships = await prisma.affiliateMembershipPeriod.findMany({ where: { participantId }, select: { id: true } }); await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: userId }, { entityId: { in: [participantId, ...memberships.map(row => row.id)] } }] } }); await prisma.affiliateMembershipCode.deleteMany({ where: { membershipPeriod: { participantId } } }); await prisma.affiliateMembershipPeriod.deleteMany({ where: { participantId } }); await prisma.affiliateParticipant.deleteMany({ where: { id: participantId } }); }
  if (workspaceId) { await prisma.saasSubscriptionItem.deleteMany({ where: { workspaceId } }); await prisma.saasSubscription.deleteMany({ where: { workspaceId } }); await prisma.workspaceBranding.deleteMany({ where: { workspaceId } }); await prisma.saasWorkspaceProfile.deleteMany({ where: { workspaceId } }); await prisma.saasSubscriberProfile.deleteMany({ where: { userId } }); await prisma.workspaceMember.deleteMany({ where: { workspaceId } }); }
  await prisma.subscriberProvisioningEvent.deleteMany({ where: { userId } });
  await prisma.infrastructureOrderStageEvent.deleteMany({ where: { infrastructureOrderId: infrastructureId } });
  await prisma.simulatedPaymentRecord.deleteMany({ where: { customerOrderId: orderId } });
  await prisma.infrastructureOrder.deleteMany({ where: { id: infrastructureId } });
  await prisma.customerNotificationIntent.deleteMany({ where: { customerOrderId: orderId } });
  await prisma.customerOrderItem.deleteMany({ where: { orderId } });
  await prisma.customerOrder.deleteMany({ where: { id: orderId } });
  if (workspaceId) await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.commerceProduct.deleteMany({ where: { id: productId } });
  await prisma.auditLog.deleteMany({ where: { actorId: userId } });
  await prisma.userProfile.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
}, timeout);

describe.sequential("Preview simulated payment", () => {
  it("preserves accepted totals and runs canonical paid fulfillment once", async () => {
    const [first, second] = await Promise.all([simulateSuccessfulPayment({ orderId, actorUserId: userId }), simulateSuccessfulPayment({ orderId, actorUserId: userId })]);
    const completed = first.workspaceId ? first : second;
    workspaceId = completed.workspaceId ?? "";
    expect(workspaceId).toBeTruthy();
    const order = await prisma.customerOrder.findUniqueOrThrow({ where: { id: orderId }, include: { simulatedPayment: true } });
    expect(order).toMatchObject({ paymentStatus: "PAID", paymentMethod: "SIMULATED_TEST" });
    expect(order.simulatedPayment).toMatchObject({ status: "COMPLETED", source: "SIMULATED_TEST", amountCents: 89040, environment: "preview" });
    expect(await prisma.workspace.count({ where: { id: workspaceId } })).toBe(1);
    expect(await prisma.workspaceMember.count({ where: { workspaceId, userId } })).toBe(1);
    expect(await prisma.saasSubscription.count({ where: { workspaceId, userId, status: "TRIALING" } })).toBe(1);
    expect(await prisma.saasSubscriptionItem.count({ where: { workspaceId, source: "SIMULATED_TEST", status: "ACTIVE" } })).toBeGreaterThan(0);
    const participant = await prisma.affiliateParticipant.findUniqueOrThrow({ where: { userId }, include: { memberships: { include: { code: true } } } });
    participantId = participant.id;
    expect(participant.memberships).toHaveLength(1);
    expect(participant.memberships[0].code?.code).toMatch(/^QR-[A-HJ-NP-Z2-9]{8}$/);
    expect(await resolveAffiliateCode(participant.memberships[0].code!.code)).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { entityId: orderId, action: "SIMULATED_PAYMENT_COMPLETED" } })).toBe(1);
  }, timeout);

  it("returns the same completed result on replay", async () => {
    const replay = await simulateSuccessfulPayment({ orderId, actorUserId: userId });
    expect(replay).toMatchObject({ orderId, workspaceId, replayed: true });
    expect(await prisma.saasSubscription.count({ where: { workspaceId, userId } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entityId: orderId, action: "SIMULATED_PAYMENT_COMPLETED" } })).toBe(1);
  }, timeout);

  it("rejects a different subscriber", async () => {
    await expect(simulateSuccessfulPayment({ orderId, actorUserId: `other-${suffix}` })).rejects.toThrow("unavailable");
  }, timeout);
});
