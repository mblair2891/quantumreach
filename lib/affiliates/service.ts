import { Prisma, type AffiliateCodeLifecycleStatus, type AffiliateMembershipPeriodStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const normalizeAffiliateCode = (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
export function validateAffiliateCode(code: string) {
  const normalized = normalizeAffiliateCode(code);
  if (normalized.length < 3 || normalized.length > 64) throw new Error("AFFILIATE_CODE_INVALID");
  return normalized;
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
