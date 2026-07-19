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

export async function bootstrapProgramOffer() { return prisma.programOffer.upsert({ where: { key: "QUANTUM_REACH_AGENCY_PROGRAM" }, update: {}, create: { key: "QUANTUM_REACH_AGENCY_PROGRAM", name: "Quantum Reach Agency Program", active: true, courseDeliveryType: "SKOOL" } }); }
export async function isOrderFinanciallyCleared(order: { paymentStatus: string; paymentMethod: string }) { return order.paymentStatus === "PAID" && ["MANUAL", "COMPLIMENTARY", "STRIPE"].includes(order.paymentMethod); }
export async function createProgramOrder(userId: string, acquisitionSessionId?: string | null) { const offer=await bootstrapProgramOffer(); return prisma.$transaction(async tx=>{ const enrollment=await tx.programEnrollment.upsert({where:{userId_programOfferId:{userId,programOfferId:offer.id}},update:{},create:{userId,programOfferId:offer.id,status:"PENDING",source:"MANUAL",externalProvider:"SKOOL"}}); const existing=await tx.customerOrder.findFirst({where:{userId,programEnrollmentId:enrollment.id,status:{in:["DRAFT","CHECKOUT_PENDING"]}}}); const order=existing??await tx.customerOrder.create({data:{userId,programEnrollmentId:enrollment.id,acquisitionSessionId:acquisitionSessionId??undefined,status:"CHECKOUT_PENDING",paymentStatus:"UNPAID",paymentMethod:"MANUAL",items:{create:{itemType:"PROGRAM",metadata:{programOfferKey:offer.key}}}}}); await tx.customerNotificationIntent.create({data:{userId,customerOrderId:order.id,recipient:"pending-auth-email",templateKey:"WELCOME"}}); return {enrollment,order}; }); }
export async function deriveInfrastructureOrderState(id:string) { const q=await prisma.infrastructureOrder.findUnique({where:{id},include:{order:true,tasks:true,operatorTasks:true}}); if(!q) throw new Error("Setup order not found."); let status:any="QUEUED",stage="Queueing setup"; if(q.priority==="MANUAL_HOLD"){status="PENDING";stage="Manual hold"} else if(!(await isOrderFinanciallyCleared(q.order))){status="PENDING";stage="Waiting for payment verification"} else if(q.customerActionRequired||q.tasks.some(t=>t.required&&t.status!=="COMPLETED"&&t.status!=="WAIVED")){status="WAITING_ON_CUSTOMER";stage="Waiting on customer information"} else if(q.blockedReason){status="WAITING_ON_PROVIDER";stage=q.blockedReason} else if(q.operatorTasks.some(t=>t.status!=="COMPLETED"&&t.status!=="WAIVED")){status="IN_PROGRESS";stage="Quantum Reach provisioning"} else {status="WAITING_ON_PROVIDER";stage="Waiting on sending provider"}; if(q.status!==status||q.currentStage!==stage){await prisma.$transaction([prisma.infrastructureOrder.update({where:{id},data:{status,currentStage:stage}}),prisma.infrastructureOrderStageEvent.create({data:{infrastructureOrderId:id,previousStage:q.currentStage,newStage:stage,eventType:"STATE_DERIVED",actorType:"SYSTEM"}})]);} return {status,stage}; }
export async function verifyManualPayment(infrastructureOrderId:string, operatorId:string, complimentary=false){const q=await prisma.infrastructureOrder.findUniqueOrThrow({where:{id:infrastructureOrderId},include:{order:true}});await prisma.customerOrder.update({where:{id:q.customerOrderId},data:{paymentStatus:"PAID",paymentMethod:complimentary?"COMPLIMENTARY":"MANUAL",paymentVerifiedAt:new Date(),paymentVerifiedById:operatorId,status:"PAID"}});await prisma.infrastructureOrderStageEvent.create({data:{infrastructureOrderId,eventType:complimentary?"COMPLIMENTARY_GRANTED":"PAYMENT_VERIFIED",actorType:"OPERATOR",actorId:operatorId,newStage:"Payment verified"}});return fulfillCustomerOrder(q.customerOrderId,operatorId);}
export async function fulfillCustomerOrder(orderId:string,actorId:string){const order=await prisma.customerOrder.findUniqueOrThrow({where:{id:orderId},include:{items:true}});if(!(await isOrderFinanciallyCleared(order)))throw new Error("Order is not financially cleared.");const user=await prisma.userProfile.findUniqueOrThrow({where:{id:order.userId}});const workspace=order.workspaceId?await prisma.workspace.findUniqueOrThrow({where:{id:order.workspaceId}}):await prisma.workspace.create({data:{name:`${user.firstName??"Quantum Reach"} Workspace`,slug:`subscriber-${user.id.slice(-8)}`,ownerId:user.id}});await prisma.workspaceMember.upsert({where:{workspaceId_userId:{workspaceId:workspace.id,userId:user.id}},update:{roleKey:"WORKSPACE_OWNER"},create:{workspaceId:workspace.id,userId:user.id,roleKey:"WORKSPACE_OWNER"}});await prisma.saasWorkspaceProfile.upsert({where:{workspaceId:workspace.id},update:{},create:{workspaceId:workspace.id,referralAttributionId:order.affiliateAttributionId}});await prisma.customerOrder.update({where:{id:orderId},data:{workspaceId:workspace.id,status:"PARTIALLY_FULFILLED"}});if(order.programEnrollmentId)await prisma.programEnrollment.update({where:{id:order.programEnrollmentId},data:{status:"ACTIVE",activatedAt:new Date()}});for(const key of ["QUANTUM_REACH_CORE",...order.items.map(i=>(i.metadata as any).productKey).filter(Boolean)]){const product=await prisma.commerceProduct.findUnique({where:{key}});if(product){const exists=await prisma.saasSubscriptionItem.findFirst({where:{workspaceId:workspace.id,commerceProductId:product.id,status:"ACTIVE"}});if(!exists)await prisma.saasSubscriptionItem.create({data:{workspaceId:workspace.id,commerceProductId:product.id,source:order.paymentMethod==="COMPLIMENTARY"?"COMPLIMENTARY":"MANUAL_OPERATOR",status:"ACTIVE"}})}}const infra=await prisma.infrastructureOrder.findUnique({where:{customerOrderId:orderId}});if(infra){await prisma.infrastructureOrder.update({where:{id:infra.id},data:{workspaceId:workspace.id}});await deriveInfrastructureOrderState(infra.id)}await prisma.customerNotificationIntent.create({data:{userId:user.id,customerOrderId:orderId,recipient:user.email,templateKey:"SETUP_STARTED"}});return workspace;}
