import { randomBytes } from "node:crypto";
import { Prisma, type AffiliateCodeLifecycleStatus, type AffiliateMembershipPeriodStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const normalizeAffiliateCode = (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
export function validateAffiliateCode(code: string) {
  const normalized = normalizeAffiliateCode(code);
  if (normalized.length < 3 || normalized.length > 64) throw new Error("AFFILIATE_CODE_INVALID");
  return normalized;
}

const affiliateCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const automaticEnrollmentAttempts = 5;

/** Generates an opaque, non-derived, customer-readable code using rejection sampling. */
export function generateAffiliateCode() {
  let value = "";
  while (value.length < 8) {
    for (const byte of randomBytes(16)) {
      const unbiasedLimit = Math.floor(256 / affiliateCodeAlphabet.length) * affiliateCodeAlphabet.length;
      if (byte >= unbiasedLimit) continue;
      value += affiliateCodeAlphabet[byte % affiliateCodeAlphabet.length];
      if (value.length === 8) break;
    }
  }
  return `QR-${value}`;
}

export type SubscriberAffiliateLifecycleInput = {
  userId: string;
  email: string;
  displayName: string;
  subscriptionId: string;
  correlationId: string;
};

function automaticAuditMetadata(input: SubscriberAffiliateLifecycleInput, trigger: "SUBSCRIPTION_ACTIVATED" | "SUBSCRIPTION_ACCESS_ENDED") {
  return { scope: "PLATFORM", actorType: "SYSTEM", trigger, correlationId: input.correlationId, subscriberUserId: input.userId, subscriptionId: input.subscriptionId };
}

function retryableEnrollmentError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code);
}

/** Idempotent authority for automatic enrollment on paid subscriber access activation. */
export async function ensureAffiliateMembershipForActiveSubscriber(input: SubscriberAffiliateLifecycleInput) {
  for (let attempt = 1; attempt <= automaticEnrollmentAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(async tx => {
        let participant = await tx.affiliateParticipant.findFirst({ where: { OR: [{ userId: input.userId }, { email: input.email.trim().toLowerCase() }] } });
        let participantCreated = false;
        if (participant?.userId && participant.userId !== input.userId) throw new Error("AFFILIATE_PARTICIPANT_IDENTITY_CONFLICT");
        if (!participant) {
          participant = await tx.affiliateParticipant.create({ data: { userId: input.userId, email: input.email.trim().toLowerCase(), displayName: input.displayName.trim() } });
          participantCreated = true;
        } else if (!participant.userId) {
          participant = await tx.affiliateParticipant.update({ where: { id: participant.id }, data: { userId: input.userId, displayName: input.displayName.trim() } });
        }
        const existing = await tx.affiliateMembershipPeriod.findFirst({ where: { participantId: participant.id, status: { in: ["ACTIVE", "SUSPENDED"] } }, include: { code: true } });
        if (existing?.code) return { participant, membership: existing, code: existing.code, created: false };

        const previous = await tx.affiliateMembershipPeriod.findFirst({ where: { participantId: participant.id, status: "ENDED" }, orderBy: { endedAt: "desc" } });
        const membership = await tx.affiliateMembershipPeriod.create({ data: { participantId: participant.id } });
        const codeValue = generateAffiliateCode();
        const code = await tx.affiliateMembershipCode.create({ data: { membershipPeriodId: membership.id, code: codeValue, normalizedCode: codeValue } });
        const base = { ...automaticAuditMetadata(input, "SUBSCRIPTION_ACTIVATED"), participantId: participant.id, membershipPeriodId: membership.id, codeId: code.id, isResubscription: Boolean(previous), previous: previous ? { membershipPeriodId: previous.id, status: previous.status, endedAt: previous.endedAt } : null };
        if (participantCreated) await tx.auditLog.create({ data: { workspaceId: null, action: "AFFILIATE_PARTICIPANT_AUTOMATICALLY_CREATED", entityType: "AffiliateParticipant", entityId: participant.id, metadata: { ...base, next: { userId: participant.userId, email: participant.email } } } });
        await tx.auditLog.create({ data: { workspaceId: null, action: "AFFILIATE_MEMBERSHIP_AUTOMATICALLY_STARTED", entityType: "AffiliateMembershipPeriod", entityId: membership.id, metadata: { ...base, next: { status: membership.status, startedAt: membership.startedAt } } } });
        await tx.auditLog.create({ data: { workspaceId: null, action: "AFFILIATE_CODE_AUTOMATICALLY_GENERATED", entityType: "AffiliateMembershipCode", entityId: code.id, metadata: { ...base, next: { status: code.status, normalizedCode: code.normalizedCode } } } });
        return { participant, membership: { ...membership, code }, code, created: true };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt < automaticEnrollmentAttempts && retryableEnrollmentError(error)) {
        await new Promise(resolve => setTimeout(resolve, attempt * 25));
        continue;
      }
      if (retryableEnrollmentError(error)) throw new Error("AFFILIATE_AUTOMATIC_ENROLLMENT_FAILED");
      throw error;
    }
  }
  throw new Error("AFFILIATE_AUTOMATIC_ENROLLMENT_FAILED");
}

/** Idempotently ends access only after the application has declared subscriber access ended. */
export async function endAffiliateMembershipForSubscriberAccessEnd(input: SubscriberAffiliateLifecycleInput) {
  return prisma.$transaction(async tx => {
    const participant = await tx.affiliateParticipant.findUnique({ where: { userId: input.userId } });
    if (!participant) return null;
    const membership = await tx.affiliateMembershipPeriod.findFirst({ where: { participantId: participant.id, status: { in: ["ACTIVE", "SUSPENDED"] } }, include: { code: true } });
    if (!membership) return null;
    const now = new Date();
    const ended = await tx.affiliateMembershipPeriod.update({ where: { id: membership.id }, data: { status: "ENDED", endedAt: now, terminationReason: "SUBSCRIBER_ACCESS_ENDED" } });
    const retired = membership.code?.status === "RETIRED" ? membership.code : membership.code ? await tx.affiliateMembershipCode.update({ where: { id: membership.code.id }, data: { status: "RETIRED", retiredAt: now, retirementReason: "SUBSCRIBER_ACCESS_ENDED" } }) : null;
    const base = { ...automaticAuditMetadata(input, "SUBSCRIPTION_ACCESS_ENDED"), participantId: participant.id, membershipPeriodId: membership.id, codeId: retired?.id, previous: { status: membership.status, codeStatus: membership.code?.status }, next: { status: ended.status, endedAt: ended.endedAt, codeStatus: retired?.status } };
    await tx.auditLog.create({ data: { workspaceId: null, action: "AFFILIATE_MEMBERSHIP_AUTOMATICALLY_ENDED", entityType: "AffiliateMembershipPeriod", entityId: membership.id, metadata: base } });
    if (retired) await tx.auditLog.create({ data: { workspaceId: null, action: "AFFILIATE_CODE_AUTOMATICALLY_RETIRED", entityType: "AffiliateMembershipCode", entityId: retired.id, metadata: base } });
    return { participant, membership: ended, code: retired };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function reconcileAffiliateMembershipForSubscriptionStatus(input: SubscriberAffiliateLifecycleInput & { status: string }) {
  if (["ACTIVE", "TRIALING"].includes(input.status)) return ensureAffiliateMembershipForActiveSubscriber(input);
  if (["CANCELED", "UNPAID"].includes(input.status)) return endAffiliateMembershipForSubscriberAccessEnd(input);
  return null;
}

export async function createAffiliateParticipant(input:{email:string;displayName:string;userId?:string;createdById?:string}) {
  if (!input.email.trim() || !input.displayName.trim()) throw new Error("AFFILIATE_PARTICIPANT_INVALID");
  return prisma.affiliateParticipant.create({data:{email:input.email.trim().toLowerCase(),displayName:input.displayName.trim(),userId:input.userId,createdById:input.createdById}});
}

export async function startAffiliateMembership(input:{participantId:string;code:string;createdById?:string}) {
  const normalizedCode=validateAffiliateCode(input.code);
  return prisma.$transaction(async tx=>{
    const open=await tx.affiliateMembershipPeriod.findFirst({where:{participantId:input.participantId,status:{in:["ACTIVE","SUSPENDED"]}}});
    if(open)throw new Error("AFFILIATE_MEMBERSHIP_ALREADY_OPEN");
    const period=await tx.affiliateMembershipPeriod.create({data:{participantId:input.participantId,createdById:input.createdById}});
    const code=await tx.affiliateMembershipCode.create({data:{membershipPeriodId:period.id,code:input.code.trim(),normalizedCode}});
    return {...period,code};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}

async function transitionMembership(id:string, expected:AffiliateMembershipPeriodStatus, next:AffiliateMembershipPeriodStatus) {
  return prisma.$transaction(async tx=>{
    const period=await tx.affiliateMembershipPeriod.findUniqueOrThrow({where:{id},include:{code:true}});
    if(period.status!==expected||period.endedAt)throw new Error("AFFILIATE_MEMBERSHIP_TRANSITION_DENIED");
    const updated=await tx.affiliateMembershipPeriod.update({where:{id},data:{status:next}});
    if(period.code)await tx.affiliateMembershipCode.update({where:{id:period.code.id},data:{status:next==="SUSPENDED"?"SUSPENDED":"ACTIVE"}});
    return updated;
  });
}
export const suspendAffiliateMembership=(id:string)=>transitionMembership(id,"ACTIVE","SUSPENDED");
export const resumeSuspendedAffiliateMembership=(id:string)=>transitionMembership(id,"SUSPENDED","ACTIVE");

export async function endAffiliateMembership(id:string,reason:string) {
  if(!reason.trim())throw new Error("AFFILIATE_TERMINATION_REASON_REQUIRED");
  return prisma.$transaction(async tx=>{
    const period=await tx.affiliateMembershipPeriod.findUniqueOrThrow({where:{id},include:{code:true}});
    if(period.status==="ENDED"||period.endedAt)throw new Error("AFFILIATE_MEMBERSHIP_ENDED");
    const now=new Date();
    const updated=await tx.affiliateMembershipPeriod.update({where:{id},data:{status:"ENDED",endedAt:now,terminationReason:reason.trim()}});
    if(period.code&&period.code.status!=="RETIRED")await tx.affiliateMembershipCode.update({where:{id:period.code.id},data:{status:"RETIRED",retiredAt:now,retirementReason:reason.trim()}});
    return updated;
  });
}

export async function retireAffiliateCode(id:string,reason:string) {
  if(!reason.trim())throw new Error("AFFILIATE_RETIREMENT_REASON_REQUIRED");
  const code=await prisma.affiliateMembershipCode.findUniqueOrThrow({where:{id}});
  if(code.status==="RETIRED")throw new Error("AFFILIATE_CODE_RETIRED");
  return prisma.affiliateMembershipCode.update({where:{id},data:{status:"RETIRED",retiredAt:new Date(),retirementReason:reason.trim()}});
}

export async function resolveAffiliateCode(raw:string) {
  const normalizedCode=normalizeAffiliateCode(raw);
  if(!normalizedCode)return null;
  const code=await prisma.affiliateMembershipCode.findUnique({where:{normalizedCode},include:{membershipPeriod:true}});
  return code?.status==="ACTIVE"&&code.membershipPeriod.status==="ACTIVE"&&!code.membershipPeriod.endedAt?{codeId:code.id,membershipPeriodId:code.membershipPeriodId}:null;
}

export async function captureAffiliateAttribution(input:{code:string;acquisitionSessionId:string;sourceMetadata?:Prisma.InputJsonObject}) {
  return prisma.$transaction(async tx=>{
    const normalizedCode=normalizeAffiliateCode(input.code);
    const code=await tx.affiliateMembershipCode.findUnique({where:{normalizedCode},include:{membershipPeriod:true}});
    if(!code||code.status!=="ACTIVE"||code.membershipPeriod.status!=="ACTIVE"||code.membershipPeriod.endedAt)return null;
    const current=await tx.affiliateReferralAttribution.findFirst({where:{acquisitionSessionId:input.acquisitionSessionId,status:{in:["CAPTURED","LOCKED"]}}});
    if(current?.status==="LOCKED")return current;
    if(current?.affiliateCodeId===code.id)return current;
    if(current)await tx.affiliateReferralAttribution.update({where:{id:current.id},data:{status:"INVALIDATED",invalidatedAt:new Date(),invalidationReason:"PRE_AUTH_LAST_CLICK_REPLACED"}});
    const attribution=await tx.affiliateReferralAttribution.create({data:{affiliateMembershipPeriodId:code.membershipPeriodId,affiliateCodeId:code.id,acquisitionSessionId:input.acquisitionSessionId,sourceMetadata:input.sourceMetadata??{}}});
    await tx.acquisitionSession.update({where:{id:input.acquisitionSessionId},data:{affiliateAttributionId:attribution.id}});
    return attribution;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}

export async function lockAffiliateAttribution(input:{acquisitionSessionId:string;orderId:string;customerUserId:string;workspaceId?:string},tx:Prisma.TransactionClient) {
  const attribution=await tx.affiliateReferralAttribution.findFirst({where:{acquisitionSessionId:input.acquisitionSessionId,status:{in:["CAPTURED","LOCKED"]}},include:{membershipPeriod:{include:{participant:true}}}});
  if(!attribution)return null;
  if(attribution.status==="LOCKED")return attribution;
  if(attribution.membershipPeriod.participant.userId===input.customerUserId){
    const invalidated=await tx.affiliateReferralAttribution.update({where:{id:attribution.id},data:{status:"INVALIDATED",invalidatedAt:new Date(),invalidationReason:"SELF_REFERRAL"}});
    await tx.acquisitionSession.update({where:{id:input.acquisitionSessionId},data:{affiliateAttributionId:null}});
    await tx.customerOrder.update({where:{id:input.orderId},data:{affiliateAttributionId:null}});
    return invalidated;
  }
  const locked=await tx.affiliateReferralAttribution.update({where:{id:attribution.id},data:{status:"LOCKED",lockedAt:new Date(),orderId:input.orderId,customerUserId:input.customerUserId,workspaceId:input.workspaceId}});
  await tx.customerOrder.update({where:{id:input.orderId},data:{affiliateAttributionId:locked.id}});
  return locked;
}
export const invalidateAffiliateAttribution=(id:string,reason:string)=>prisma.affiliateReferralAttribution.update({where:{id},data:{status:"INVALIDATED",invalidatedAt:new Date(),invalidationReason:reason}});
export const getAffiliateAttributionForOrder=(orderId:string)=>prisma.affiliateReferralAttribution.findFirst({where:{orderId,status:"LOCKED"}});
export const getAffiliateAttributionForCustomer=(customerUserId:string)=>prisma.affiliateReferralAttribution.findFirst({where:{customerUserId,status:"LOCKED"}});

export function canTransitionCode(current:AffiliateCodeLifecycleStatus,next:AffiliateCodeLifecycleStatus){
  if(current==="RETIRED")return false;
  return next==="RETIRED"||(current==="ACTIVE"&&next==="SUSPENDED")||(current==="SUSPENDED"&&next==="ACTIVE");
}
