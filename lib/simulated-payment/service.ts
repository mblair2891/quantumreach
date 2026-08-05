import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { fulfillCustomerOrder } from "@/lib/customer-journey/service";
import { assertSimulatedPaymentEnvironment, simulatedPaymentEnvironmentName } from "./environment";
import { issueAccountSetupToken, type AccountSetupTokenIssue } from "@/lib/auth/account-setup";

const object = (value: Prisma.JsonValue | null): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const productKey = (metadata: Prisma.JsonValue): string | undefined =>
  typeof object(metadata).productKey === "string" ? (object(metadata).productKey as string) : undefined;

function paymentSnapshot(order: {
  acceptedCouponSnapshot: Prisma.JsonValue | null;
  acceptedCommercialTerms: Prisma.JsonValue | null;
  setupPriority: string;
  items: Array<{ itemType: string; metadata: Prisma.JsonValue }>;
}) {
  const coupon = object(order.acceptedCouponSnapshot);
  const terms = object(order.acceptedCommercialTerms);
  const packageKey = order.items.find((item) => item.itemType === "SENDING_PACKAGE")?.metadata;
  const acceptedTotal = coupon.todayTotalCents;
  const amountCents =
    typeof acceptedTotal === "number"
      ? acceptedTotal
      : Number(terms.recurringPriceCents ?? 0) +
        Number(terms.setupPriceCents ?? 0) +
        (order.setupPriority === "PRIORITY" ? 25000 : 0);
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new Error("The accepted order total is invalid.");
  const key = packageKey ? productKey(packageKey) : undefined;
  if (!key || !order.acceptedCommercialTerms) throw new Error("The order configuration is incomplete.");
  return { amountCents, packageKey: key, couponSnapshot: coupon };
}

export type SimulatedPaymentResult = {
  orderId: string;
  workspaceId?: string | null;
  subscriptionId?: string | null;
  replayed: boolean;
  processing?: boolean;
  /** Present for pay-first guest orders that still need account setup. */
  setup?: AccountSetupTokenIssue;
  requiresAccountSetup?: boolean;
};

const GUEST_ACTOR = "SYSTEM_GUEST_PREVIEW";

/** Preview/local-only financial-clearance boundary. The UI and action must gate too. */
export async function simulateSuccessfulPayment(input: {
  orderId: string;
  /** Authenticated subscriber id, or omitted/guest for pay-first guest orders. */
  actorUserId?: string | null;
}): Promise<SimulatedPaymentResult> {
  assertSimulatedPaymentEnvironment();
  const environment = simulatedPaymentEnvironmentName();
  const order = await prisma.customerOrder.findUnique({
    where: { id: input.orderId },
    include: { items: true, simulatedPayment: true },
  });
  if (!order) throw new Error("This order is unavailable for test payment.");

  const isGuestOrder = !order.userId;
  const actorUserId = isGuestOrder ? GUEST_ACTOR : input.actorUserId;
  if (!isGuestOrder && order.userId !== input.actorUserId) {
    throw new Error("This order is unavailable for test payment.");
  }
  if (isGuestOrder && !order.purchaserEmail) {
    throw new Error("Guest orders require a purchaser email before test payment.");
  }

  if (order.simulatedPayment?.status === "COMPLETED") {
    await prisma.auditLog.create({
      data: {
        workspaceId: null,
        actorId: isGuestOrder ? null : actorUserId,
        action: "SIMULATED_PAYMENT_REPLAY_NOOP",
        entityType: "CustomerOrder",
        entityId: order.id,
        metadata: {
          scope: "PLATFORM",
          actorUserId,
          customerOrderId: order.id,
          paymentSource: "SIMULATED_TEST",
          environment,
          packageKey: order.simulatedPayment.packageKey,
          amountCents: order.simulatedPayment.amountCents,
          currency: order.simulatedPayment.currency,
          correlationId: order.simulatedPayment.correlationId,
          subscriptionId: order.simulatedPayment.subscriptionId,
          workspaceId: order.simulatedPayment.workspaceId,
          guest: isGuestOrder,
        },
      },
    });
    if (isGuestOrder) {
      const setup = await issueAccountSetupToken(order.id);
      return {
        orderId: order.id,
        workspaceId: order.simulatedPayment.workspaceId,
        subscriptionId: order.simulatedPayment.subscriptionId,
        replayed: true,
        requiresAccountSetup: true,
        setup,
      };
    }
    return {
      orderId: order.id,
      workspaceId: order.simulatedPayment.workspaceId,
      subscriptionId: order.simulatedPayment.subscriptionId,
      replayed: true,
    };
  }
  if (order.simulatedPayment?.status === "PROCESSING") {
    return { orderId: order.id, replayed: true, processing: true, requiresAccountSetup: isGuestOrder };
  }

  const retryingFailedSimulation =
    order.simulatedPayment?.status === "FAILED" && order.paymentMethod === "SIMULATED_TEST";
  if (
    (!retryingFailedSimulation && order.paymentStatus === "PAID") ||
    (!retryingFailedSimulation && !["DRAFT", "CHECKOUT_PENDING", "FAILED"].includes(order.status))
  ) {
    throw new Error("This order is not eligible for test payment.");
  }
  if (order.stripePaymentIntentId || order.stripeSubscriptionId) {
    throw new Error("A provider payment already exists for this order.");
  }

  const snapshot = paymentSnapshot(order);
  const correlationId = order.simulatedPayment?.correlationId ?? randomUUID();
  const metadata = {
    scope: "PLATFORM",
    actorUserId,
    customerOrderId: order.id,
    paymentSource: "SIMULATED_TEST",
    environment,
    packageKey: snapshot.packageKey,
    amountCents: snapshot.amountCents,
    currency: "USD",
    correlationId,
    guest: isGuestOrder,
  };

  try {
    await prisma.$transaction(
      async (tx) => {
        const latest = await tx.customerOrder.findUniqueOrThrow({ where: { id: order.id } });
        if (!retryingFailedSimulation && latest.paymentStatus === "PAID") {
          throw new Error("This order already has completed payment clearance.");
        }
        if (retryingFailedSimulation) {
          const claim = await tx.simulatedPaymentRecord.updateMany({
            where: { customerOrderId: order.id, status: "FAILED" },
            data: { actorUserId: actorUserId!, status: "PROCESSING", safeError: null },
          });
          if (claim.count !== 1) throw new Error("Test payment is already processing.");
        } else {
          await tx.simulatedPaymentRecord.create({
            data: {
              customerOrderId: order.id,
              actorUserId: actorUserId!,
              amountCents: snapshot.amountCents,
              correlationId,
              environment,
              packageKey: snapshot.packageKey,
            },
          });
        }
        await tx.auditLog.create({
          data: {
            workspaceId: null,
            actorId: isGuestOrder ? null : actorUserId,
            action: "SIMULATED_PAYMENT_INITIATED",
            entityType: "CustomerOrder",
            entityId: order.id,
            metadata,
          },
        });
        await tx.customerOrder.update({
          where: { id: order.id },
          data: {
            status: "PAID",
            paymentStatus: "PAID",
            paymentMethod: "SIMULATED_TEST",
            paymentVerifiedAt: new Date(),
            paymentVerifiedById: isGuestOrder ? null : actorUserId,
          },
        });
        const infrastructure = await tx.infrastructureOrder.findUnique({ where: { customerOrderId: order.id } });
        if (infrastructure) {
          await tx.infrastructureOrderStageEvent.create({
            data: {
              infrastructureOrderId: infrastructure.id,
              eventType: "SIMULATED_TEST_PAYMENT_VERIFIED",
              actorType: isGuestOrder ? "SYSTEM" : "CUSTOMER",
              actorId: actorUserId,
              newStage: "Test payment verified",
            },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { orderId: order.id, replayed: true, processing: true, requiresAccountSetup: isGuestOrder };
    }
    await prisma.auditLog
      .create({
        data: {
          workspaceId: null,
          actorId: isGuestOrder ? null : actorUserId,
          action: "SIMULATED_PAYMENT_FAILED",
          entityType: "CustomerOrder",
          entityId: order.id,
          metadata: { ...metadata, safeError: "Test payment could not be completed." },
        },
      })
      .catch(() => undefined);
    throw error;
  }

  // Guest pay-first: mark payment complete and issue setup token; do not fulfill until account exists.
  if (isGuestOrder) {
    try {
      const setup = await issueAccountSetupToken(order.id);
      await prisma.simulatedPaymentRecord.update({
        where: { customerOrderId: order.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      await prisma.auditLog.create({
        data: {
          workspaceId: null,
          action: "SIMULATED_PAYMENT_COMPLETED",
          entityType: "CustomerOrder",
          entityId: order.id,
          metadata: { ...metadata, requiresAccountSetup: true, setupTokenId: setup.tokenId },
        },
      });
      return { orderId: order.id, replayed: false, requiresAccountSetup: true, setup };
    } catch (error) {
      await prisma.simulatedPaymentRecord
        .update({
          where: { customerOrderId: order.id },
          data: { status: "FAILED", safeError: "Setup invite could not be issued." },
        })
        .catch(() => undefined);
      throw error;
    }
  }

  try {
    const workspace = await fulfillCustomerOrder(order.id);
    const subscription = await prisma.saasSubscription.findFirst({
      where: { customerOrderId: order.id, workspaceId: workspace.id, userId: input.actorUserId! },
    });
    await prisma.$transaction([
      prisma.simulatedPaymentRecord.update({
        where: { customerOrderId: order.id },
        data: {
          status: "COMPLETED",
          workspaceId: workspace.id,
          subscriptionId: subscription?.id,
          completedAt: new Date(),
        },
      }),
      prisma.auditLog.create({
        data: {
          workspaceId: null,
          actorId: actorUserId,
          action: "SIMULATED_PAYMENT_COMPLETED",
          entityType: "CustomerOrder",
          entityId: order.id,
          metadata: { ...metadata, workspaceId: workspace.id, subscriptionId: subscription?.id },
        },
      }),
    ]);
    return {
      orderId: order.id,
      workspaceId: workspace.id,
      subscriptionId: subscription?.id,
      replayed: false,
    };
  } catch (error) {
    await prisma.simulatedPaymentRecord
      .update({
        where: { customerOrderId: order.id },
        data: { status: "FAILED", safeError: "Canonical fulfillment requires a safe retry." },
      })
      .catch(() => undefined);
    await prisma.auditLog
      .create({
        data: {
          workspaceId: null,
          actorId: actorUserId,
          action: "SIMULATED_PAYMENT_FAILED",
          entityType: "CustomerOrder",
          entityId: order.id,
          metadata: { ...metadata, safeError: "Canonical fulfillment requires a safe retry." },
        },
      })
      .catch(() => undefined);
    throw error;
  }
}
