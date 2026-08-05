import { prisma } from "@/lib/db/prisma";
import { InfrastructureOrderStatus, Prisma, SetupPriority } from "@prisma/client";
import { trackFunnelEvent } from "./funnel";
import { loadValidatedDraft } from "./acquisition-draft";
import { acceptCommercialTerms } from "@/lib/commercial/service";
import { reserveCouponForOrder } from "@/lib/commercial/coupons";
import { ensureAffiliateMembershipForActiveSubscriber, lockAffiliateAttribution } from "@/lib/affiliates/service";

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
  const product = await prisma.commerceProduct.findFirst({ where: { key: input.productKey, category: "SENDING_PACKAGE", active: true } });
  if (!product) throw new Error("The selected infrastructure package is not available.");
  return prisma.$transaction(async (tx) => {
    const acquisition = input.acquisitionSessionId ? await tx.acquisitionSession.findUnique({ where: { id: input.acquisitionSessionId } }) : await tx.acquisitionSession.findFirst({ where: { userId: input.userId }, orderBy: { clickedAt: "desc" } });
    const existing = await tx.infrastructureOrder.findFirst({ where: { order: { userId: input.userId } }, include: { order: true }, orderBy: { createdAt: "desc" } });
    if (existing) {
      await tx.customerOrderItem.deleteMany({ where: { orderId: existing.customerOrderId, itemType: "SENDING_PACKAGE" } });
      await tx.customerOrderItem.create({ data: { orderId: existing.customerOrderId, itemType: "SENDING_PACKAGE", metadata: { productKey: input.productKey } } });
      const infrastructureOrder = await tx.infrastructureOrder.update({ where: { id: existing.id }, data: { selectedProductKey: input.productKey } });
      return { order: existing.order, infrastructureOrder };
    }
    const enrollment = input.programEnrollmentId ? { id: input.programEnrollmentId } : await tx.programEnrollment.findFirst({ where: { userId: input.userId }, orderBy: { enrolledAt: "desc" } });
    const order = await tx.customerOrder.create({ data: { userId: input.userId, programEnrollmentId: enrollment?.id, acquisitionSessionId: acquisition?.id, affiliateAttributionId: input.affiliateAttributionId ?? acquisition?.affiliateAttributionId, setupPriority: priority, status: "CHECKOUT_PENDING", paymentStatus: "UNPAID", paymentMethod: "MANUAL", items: { create: [{ itemType: "SENDING_PACKAGE", metadata: { productKey: input.productKey } }] } } });
    const infrastructureOrder = await tx.infrastructureOrder.create({ data: { customerOrderId: order.id, selectedProductKey: input.productKey, priority, status: "WAITING_ON_CUSTOMER", currentStage: "Required setup information", customerActionRequired: true, tasks: { create: requiredSetupTasks.map(([taskType, title]) => ({ taskType, title })) }, operatorTasks: { create: { taskType: "DOMAIN_REVIEW", title: "Review domain and provider readiness", priority } } } });
    return { order, infrastructureOrder };
  });
}

export async function selectSetupPriority(userId: string, priority: SetupPriority) {
  if (!["STANDARD", "PRIORITY"].includes(priority)) throw new Error("The selected setup priority is not available.");
  return prisma.$transaction(async tx => {
    const infrastructure = await tx.infrastructureOrder.findFirstOrThrow({ where: { order: { userId } }, orderBy: { createdAt: "desc" } });
    await tx.customerOrderItem.deleteMany({ where: { orderId: infrastructure.customerOrderId, itemType: "SETUP_PRIORITY" } });
    if (priority !== "STANDARD") await tx.customerOrderItem.create({ data: { orderId: infrastructure.customerOrderId, itemType: "SETUP_PRIORITY", metadata: { priority } } });
    await tx.customerOrder.update({ where: { id: infrastructure.customerOrderId }, data: { setupPriority: priority } });
    return tx.infrastructureOrder.update({ where: { id: infrastructure.id }, data: { priority } });
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

export async function bootstrapProgramOffer() { return prisma.programOffer.upsert({ where: { key: "QUANTUM_REACH_AGENCY_PROGRAM" }, update: {}, create: { key: "QUANTUM_REACH_AGENCY_PROGRAM", name: "Quantum Reach Agency Program", active: true, courseDeliveryType: "SKOOL" } }); }
export async function isOrderFinanciallyCleared(order: { paymentStatus: string; paymentMethod: string }) { return order.paymentStatus === "PAID" && ["MANUAL", "COMPLIMENTARY", "STRIPE", "SIMULATED_TEST"].includes(order.paymentMethod); }
export async function createProgramOrder(userId: string, acquisitionSessionId?: string | null) { const offer=await bootstrapProgramOffer(); const result=await prisma.$transaction(async tx=>{ const acquisition=acquisitionSessionId?await tx.acquisitionSession.findUnique({where:{id:acquisitionSessionId}}):await tx.acquisitionSession.findFirst({where:{userId},orderBy:{clickedAt:"desc"}}); const enrollment=await tx.programEnrollment.upsert({where:{userId_programOfferId:{userId,programOfferId:offer.id}},update:{},create:{userId,programOfferId:offer.id,status:"PENDING",source:"MANUAL",externalProvider:"SKOOL"}}); const existing=await tx.customerOrder.findFirst({where:{userId,programEnrollmentId:enrollment.id,status:{in:["DRAFT","CHECKOUT_PENDING"]}}}); const order=existing??await tx.customerOrder.create({data:{userId,programEnrollmentId:enrollment.id,acquisitionSessionId:acquisition?.id,affiliateAttributionId:acquisition?.affiliateAttributionId,status:"CHECKOUT_PENDING",paymentStatus:"UNPAID",paymentMethod:"MANUAL",items:{create:{itemType:"PROGRAM",metadata:{programOfferKey:offer.key}}}}}); await tx.customerNotificationIntent.create({data:{userId,customerOrderId:order.id,recipient:"pending-auth-email",templateKey:"INFRASTRUCTURE_SELECTION_REQUIRED",metadata:{path:"/setup/infrastructure"}}}); return {enrollment,order}; }); await trackFunnelEvent("PROGRAM_ORDER_CREATED",{userId,acquisitionSessionId:acquisitionSessionId??undefined,customerOrderId:result.order.id}); return result; }

export type GuestPurchaserInput = {
  email: string;
  firstName: string;
  lastName: string;
  businessName: string;
  businessType: string;
  timezone: string;
  country: string;
  intendedUse: string;
};

/** Pay-first: convert anonymous draft into unpaid order without a UserProfile. */
export async function createGuestAcquisitionOrder(anonymousId: string, purchaser: GuestPurchaserInput) {
  const email = purchaser.email.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("A valid email is required.");
  const selected = await loadValidatedDraft(anonymousId);
  const offer = await bootstrapProgramOffer();
  const result = await prisma.$transaction(async (tx) => {
    const acquisition = selected.session;
    const existing = await tx.customerOrder.findFirst({
      where: {
        acquisitionSessionId: acquisition.id,
        purchaserEmail: email,
        status: { in: ["DRAFT", "CHECKOUT_PENDING"] },
        userId: null,
      },
    });
    const order =
      existing ??
      (await tx.customerOrder.create({
        data: {
          userId: null,
          purchaserEmail: email,
          purchaserFirstName: purchaser.firstName.trim(),
          purchaserLastName: purchaser.lastName.trim(),
          businessName: purchaser.businessName.trim(),
          businessType: purchaser.businessType.trim(),
          timezone: purchaser.timezone.trim(),
          country: purchaser.country.trim().toUpperCase(),
          intendedUse: purchaser.intendedUse.trim(),
          acquisitionSessionId: acquisition.id,
          affiliateAttributionId: acquisition.affiliateAttributionId,
          setupPriority: selected.draft.setupPriority!,
          status: "CHECKOUT_PENDING",
          paymentStatus: "UNPAID",
          paymentMethod: "MANUAL",
        },
      }));
    await tx.customerOrder.update({
      where: { id: order.id },
      data: {
        purchaserEmail: email,
        purchaserFirstName: purchaser.firstName.trim(),
        purchaserLastName: purchaser.lastName.trim(),
        businessName: purchaser.businessName.trim(),
        businessType: purchaser.businessType.trim(),
        timezone: purchaser.timezone.trim(),
        country: purchaser.country.trim().toUpperCase(),
        intendedUse: purchaser.intendedUse.trim(),
        setupPriority: selected.draft.setupPriority!,
        paymentStatus: "UNPAID",
        paymentMethod: "MANUAL",
      },
    });
    await tx.customerOrderItem.deleteMany({
      where: { orderId: order.id, itemType: { in: ["PROGRAM", "SOFTWARE_CORE", "SENDING_PACKAGE", "SETUP_PRIORITY"] } },
    });
    await tx.customerOrderItem.createMany({
      data: [
        { orderId: order.id, itemType: "PROGRAM", metadata: { programOfferKey: offer.key } },
        { orderId: order.id, commerceProductId: selected.core.id, itemType: "SOFTWARE_CORE", metadata: { productKey: selected.core.key } },
        { orderId: order.id, commerceProductId: selected.infrastructure.id, itemType: "SENDING_PACKAGE", metadata: { productKey: selected.infrastructure.key } },
        {
          orderId: order.id,
          commerceProductId: selected.setup.id,
          itemType: "SETUP_PRIORITY",
          metadata: { productKey: selected.setup.key, priority: selected.draft.setupPriority! },
        },
      ],
    });
    await acceptCommercialTerms({ orderId: order.id, productId: selected.infrastructure.id }, tx);
    await reserveCouponForOrder(
      { acquisitionSessionId: acquisition.id, orderId: order.id, customerAccountId: `guest:${email}` },
      tx,
    );
    await tx.infrastructureOrder.upsert({
      where: { customerOrderId: order.id },
      update: { selectedProductKey: selected.infrastructure.key, priority: selected.draft.setupPriority! },
      create: {
        customerOrderId: order.id,
        selectedProductKey: selected.infrastructure.key,
        priority: selected.draft.setupPriority!,
        status: "WAITING_ON_CUSTOMER",
        currentStage: "Required setup information",
        customerActionRequired: true,
        tasks: { create: requiredSetupTasks.map(([taskType, title]) => ({ taskType, title })) },
        operatorTasks: {
          create: {
            taskType: "DOMAIN_REVIEW",
            title: "Review domain and provider readiness",
            priority: selected.draft.setupPriority!,
          },
        },
      },
    });
    return order;
  });
  await trackFunnelEvent("PROGRAM_ORDER_CREATED", {
    acquisitionSessionId: selected.session.id,
    customerOrderId: result.id,
    metadata: { payFirst: true, purchaserEmail: email },
  });
  return result;
}

/** Converts a safe anonymous draft into one canonical, still-unpaid authenticated order. */
export async function finalizeAcquisitionOrder(userId: string, anonymousId: string) {
  const activeSubscription = await prisma.saasSubscription.findFirst({ where: { userId, status: { in: ["ACTIVE", "TRIALING"] }, workspaceId: { not: null } } });
  if (activeSubscription) throw new Error("This account already has an active subscriber workspace. Open the dashboard instead of creating another subscription.");
  const selected = await loadValidatedDraft(anonymousId);
  if (selected.session.userId && selected.session.userId !== userId) throw new Error("This acquisition belongs to another account.");
  const offer = await bootstrapProgramOffer();
  const result = await prisma.$transaction(async tx => {
    const acquisition = await tx.acquisitionSession.update({ where: { id: selected.session.id }, data: { userId } });
    const enrollment = await tx.programEnrollment.upsert({ where: { userId_programOfferId: { userId, programOfferId: offer.id } }, update: {}, create: { userId, programOfferId: offer.id, status: "PENDING", source: "MANUAL" } });
    const existing = await tx.customerOrder.findFirst({ where: { userId, acquisitionSessionId: acquisition.id, status: { in: ["DRAFT", "CHECKOUT_PENDING"] } } });
    const order = existing ?? await tx.customerOrder.create({ data: { userId, programEnrollmentId: enrollment.id, acquisitionSessionId: acquisition.id, affiliateAttributionId: acquisition.affiliateAttributionId, setupPriority: selected.draft.setupPriority!, status: "CHECKOUT_PENDING", paymentStatus: "UNPAID", paymentMethod: "MANUAL" } });
    await tx.customerOrder.update({ where: { id: order.id }, data: { setupPriority: selected.draft.setupPriority!, paymentStatus: "UNPAID", paymentMethod: "MANUAL" } });
    await tx.customerOrderItem.deleteMany({ where: { orderId: order.id, itemType: { in: ["PROGRAM", "SOFTWARE_CORE", "SENDING_PACKAGE", "SETUP_PRIORITY"] } } });
    await tx.customerOrderItem.createMany({ data: [
      { orderId: order.id, itemType: "PROGRAM", metadata: { programOfferKey: offer.key } },
      { orderId: order.id, commerceProductId: selected.core.id, itemType: "SOFTWARE_CORE", metadata: { productKey: selected.core.key } },
      { orderId: order.id, commerceProductId: selected.infrastructure.id, itemType: "SENDING_PACKAGE", metadata: { productKey: selected.infrastructure.key } },
      { orderId: order.id, commerceProductId: selected.setup.id, itemType: "SETUP_PRIORITY", metadata: { productKey: selected.setup.key, priority: selected.draft.setupPriority! } },
    ] });
    await acceptCommercialTerms({ orderId: order.id, productId: selected.infrastructure.id }, tx);
    await reserveCouponForOrder({ acquisitionSessionId: acquisition.id, orderId: order.id, customerAccountId: userId }, tx);
    await lockAffiliateAttribution({ acquisitionSessionId: acquisition.id, orderId: order.id, customerUserId: userId }, tx);
    await tx.infrastructureOrder.upsert({ where: { customerOrderId: order.id }, update: { selectedProductKey: selected.infrastructure.key, priority: selected.draft.setupPriority! }, create: { customerOrderId: order.id, selectedProductKey: selected.infrastructure.key, priority: selected.draft.setupPriority!, status: "WAITING_ON_CUSTOMER", currentStage: "Required setup information", customerActionRequired: true, tasks: { create: requiredSetupTasks.map(([taskType, title]) => ({ taskType, title })) }, operatorTasks: { create: { taskType: "DOMAIN_REVIEW", title: "Review domain and provider readiness", priority: selected.draft.setupPriority! } } } });
    return order;
  });
  if (!(await prisma.customerNotificationIntent.findFirst({ where: { customerOrderId: result.id, templateKey: "ORDER_AWAITING_CLEARANCE" } }))) await prisma.customerNotificationIntent.create({ data: { userId, customerOrderId: result.id, recipient: "authenticated-subscriber", templateKey: "ORDER_AWAITING_CLEARANCE", metadata: { path: "/setup/confirmation" } } });
  await trackFunnelEvent("PROGRAM_ORDER_CREATED", { userId, acquisitionSessionId: selected.session.id, customerOrderId: result.id });
  return result;
}
export async function deriveInfrastructureOrderState(id:string) { const q=await prisma.infrastructureOrder.findUnique({where:{id},include:{order:true,tasks:true,operatorTasks:true}}); if(!q) throw new Error("Setup order not found."); let status: InfrastructureOrderStatus="QUEUED",stage="Queueing setup"; if(q.priority==="MANUAL_HOLD"){status="PENDING";stage="Manual hold"} else if(!(await isOrderFinanciallyCleared(q.order))){status="PENDING";stage="Waiting for payment verification"} else if(q.customerActionRequired||q.tasks.some(t=>t.required&&t.status!=="COMPLETED"&&t.status!=="WAIVED")){status="WAITING_ON_CUSTOMER";stage="Waiting on customer information"} else if(q.blockedReason){status="WAITING_ON_PROVIDER";stage=q.blockedReason} else if(q.operatorTasks.some(t=>t.status!=="COMPLETED"&&t.status!=="WAIVED")){status="IN_PROGRESS";stage="Quantum Reach provisioning"} else {status="WAITING_ON_PROVIDER";stage="Waiting on sending provider"}; if(q.status!==status||q.currentStage!==stage){await prisma.$transaction([prisma.infrastructureOrder.update({where:{id},data:{status,currentStage:stage}}),prisma.infrastructureOrderStageEvent.create({data:{infrastructureOrderId:id,previousStage:q.currentStage,newStage:stage,eventType:"STATE_DERIVED",actorType:"SYSTEM"}})]);} return {status,stage}; }
export async function verifyManualPayment(infrastructureOrderId:string, operatorId:string, complimentary=false){const q=await prisma.infrastructureOrder.findUniqueOrThrow({where:{id:infrastructureOrderId},include:{order:true}});await prisma.customerOrder.update({where:{id:q.customerOrderId},data:{paymentStatus:"PAID",paymentMethod:complimentary?"COMPLIMENTARY":"MANUAL",paymentVerifiedAt:new Date(),paymentVerifiedById:operatorId,status:"PAID"}});await prisma.infrastructureOrderStageEvent.create({data:{infrastructureOrderId,eventType:complimentary?"COMPLIMENTARY_GRANTED":"PAYMENT_VERIFIED",actorType:"OPERATOR",actorId:operatorId,newStage:"Payment verified"}});return fulfillCustomerOrder(q.customerOrderId);}
/** The centralized, verified-provider entry point for Stripe financial clearance. */
export async function verifyStripePayment(orderId:string, stripeEventId:string, paymentIntentId?:string, subscriptionId?:string){
 const order=await prisma.customerOrder.findUniqueOrThrow({where:{id:orderId}});
 if(order.paymentStatus==="PAID") { if(order.paymentMethod!=="STRIPE") return fulfillCustomerOrder(orderId); return fulfillCustomerOrder(orderId); }
 if(order.status==="CANCELED"||order.status==="REFUNDED") throw new Error("Order cannot receive Stripe clearance in its current state.");
 await prisma.customerOrder.update({where:{id:orderId},data:{status:"PAID",paymentStatus:"PAID",paymentMethod:"STRIPE",paymentVerifiedAt:new Date(),stripePaymentIntentId:paymentIntentId,stripeSubscriptionId:subscriptionId}});
 const infrastructure=await prisma.infrastructureOrder.findUnique({where:{customerOrderId:orderId}});
 if(infrastructure) await prisma.infrastructureOrderStageEvent.create({data:{infrastructureOrderId:infrastructure.id,eventType:"STRIPE_PAYMENT_VERIFIED",actorType:"SYSTEM",actorId:stripeEventId,newStage:"Payment verified"}});
 return fulfillCustomerOrder(orderId);
}
function getProductKey(metadata: Prisma.JsonValue): string | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) || !("productKey" in metadata)) return undefined;
  const productKey = metadata.productKey;
  return typeof productKey === "string" ? productKey : undefined;
}

export async function fulfillCustomerOrder(orderId:string) {
  const order = await prisma.customerOrder.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  if (!(await isOrderFinanciallyCleared(order))) throw new Error("Order is not financially cleared.");
  if (!order.userId) throw new Error("Order is not linked to a user account yet. Complete account setup first.");
  const user = await prisma.userProfile.findUniqueOrThrow({ where: { id: order.userId } });
  const eventKey = `customer-order:${orderId}:fulfillment`;
  await prisma.subscriberProvisioningEvent.upsert({ where: { idempotencyKey: eventKey }, create: { idempotencyKey: eventKey, userId: user.id, eventType: "CUSTOMER_ORDER_FULFILLMENT", status: "RUNNING" }, update: { status: "RUNNING", retryCount: { increment: 1 }, safeMessage: null } });
  try {
    const profile = await prisma.saasSubscriberProfile.findUnique({ where: { userId: user.id } });
    const progress = profile?.onboardingProgress && typeof profile.onboardingProgress === "object" && !Array.isArray(profile.onboardingProgress) ? profile.onboardingProgress as Prisma.JsonObject : {};
    const join = progress.joinProfile && typeof progress.joinProfile === "object" && !Array.isArray(progress.joinProfile) ? progress.joinProfile as Prisma.JsonObject : {};
    const businessName = typeof join.businessName === "string" ? join.businessName : `${user.firstName ?? "Subscriber"} Workspace`;
    const workspace = order.workspaceId
      ? await prisma.workspace.findUniqueOrThrow({ where: { id: order.workspaceId } })
      : await prisma.workspace.create({ data: { name: businessName, slug: `subscriber-${user.id.slice(-12).toLowerCase()}`, ownerId: user.id, settings: { timezone: join.timezone ?? "UTC", onboardingComplete: false } } });
    await prisma.workspaceMember.upsert({ where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } }, update: { roleKey: "WORKSPACE_OWNER", status: "ACTIVE" }, create: { workspaceId: workspace.id, userId: user.id, roleKey: "WORKSPACE_OWNER" } });
    await prisma.saasWorkspaceProfile.upsert({ where: { workspaceId: workspace.id }, update: {}, create: { workspaceId: workspace.id, workspaceType: "DIRECT_CUSTOMER", referralAttributionId: order.affiliateAttributionId } });
    await prisma.workspaceBranding.upsert({ where: { workspaceId: workspace.id }, update: {}, create: { workspaceId: workspace.id, brandName: businessName } });
    await prisma.saasSubscriberProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, workspaceId: workspace.id, subscriberType: "DIRECT_CUSTOMER", onboardingProgress: { joinProfileComplete: false } }, update: { workspaceId: workspace.id } });
    const corePlan = await prisma.saasPlan.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } });
    const couponSnapshot = order.acceptedCouponSnapshot && typeof order.acceptedCouponSnapshot === "object" && !Array.isArray(order.acceptedCouponSnapshot) ? order.acceptedCouponSnapshot as Prisma.JsonObject : {};
    const couponRule = couponSnapshot.coupon && typeof couponSnapshot.coupon === "object" && !Array.isArray(couponSnapshot.coupon) ? couponSnapshot.coupon as Prisma.JsonObject : {};
    const initialStatus = order.paymentMethod === "SIMULATED_TEST" && Number(couponRule.trialDays ?? 0) > 0 ? "TRIALING" : "ACTIVE";
    const subscription = await prisma.saasSubscription.findFirst({ where: { userId: user.id, workspaceId: workspace.id, status: { in: ["ACTIVE", "TRIALING"] } } })
      ?? await prisma.saasSubscription.create({ data: { userId: user.id, workspaceId: workspace.id, planKey: corePlan?.key ?? "QUANTUM_REACH_CORE", status: initialStatus, affiliateAttributionId: order.affiliateAttributionId } });
    if (order.paymentMethod !== "COMPLIMENTARY") await ensureAffiliateMembershipForActiveSubscriber({ userId: user.id, email: user.email, displayName: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email, subscriptionId: subscription.id, correlationId: eventKey });
    if (order.acceptedCommercialTerms) await prisma.saasSubscription.update({ where: { id: subscription.id }, data: { customerOrderId: order.id, commercialCatalogVersionId: order.commercialCatalogVersionId, acceptedCommercialTerms: order.acceptedCommercialTerms } });
    await prisma.customerOrder.update({ where: { id: orderId }, data: { workspaceId: workspace.id, status: "PARTIALLY_FULFILLED" } });
    if (order.programEnrollmentId) await prisma.programEnrollment.update({ where: { id: order.programEnrollmentId }, data: { status: "ACTIVE", activatedAt: new Date() } });
    for (const key of ["QUANTUM_REACH_CORE", ...order.items.map(item => getProductKey(item.metadata)).filter((key): key is string => Boolean(key))]) {
      const product = await prisma.commerceProduct.findFirst({ where: { key, active: true } });
      if (product && !(await prisma.saasSubscriptionItem.findFirst({ where: { workspaceId: workspace.id, commerceProductId: product.id, status: "ACTIVE" } }))) await prisma.saasSubscriptionItem.create({ data: { workspaceId: workspace.id, commerceProductId: product.id, source: order.paymentMethod === "STRIPE" ? "STRIPE" : order.paymentMethod === "SIMULATED_TEST" ? "SIMULATED_TEST" : order.paymentMethod === "COMPLIMENTARY" ? "COMPLIMENTARY" : "MANUAL_OPERATOR", status: "ACTIVE" } });
    }
    const infra = await prisma.infrastructureOrder.findUnique({ where: { customerOrderId: orderId } });
    if (infra) { await prisma.infrastructureOrder.update({ where: { id: infra.id }, data: { workspaceId: workspace.id } }); await deriveInfrastructureOrderState(infra.id); }
    if (!(await prisma.customerNotificationIntent.findFirst({ where: { customerOrderId: orderId, templateKey: "SETUP_STARTED" } }))) await prisma.customerNotificationIntent.create({ data: { userId: user.id, customerOrderId: orderId, recipient: user.email, templateKey: "SETUP_STARTED" } });
    await prisma.customerOrder.update({ where: { id: orderId }, data: { status: "FULFILLED" } });
    await prisma.subscriberProvisioningEvent.update({ where: { idempotencyKey: eventKey }, data: { workspaceId: workspace.id, subscriptionId: subscription.id, status: "COMPLETED", safeMessage: "Subscriber workspace activated; infrastructure may remain deferred." } });
    return workspace;
  } catch (error) {
    await prisma.subscriberProvisioningEvent.update({ where: { idempotencyKey: eventKey }, data: { status: "FAILED", safeMessage: "Subscriber fulfillment requires a safe retry." } });
    throw error;
  }
}
