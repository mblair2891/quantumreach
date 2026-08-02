"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireOperatorAccess } from "@/lib/admin/operator";
import { endAffiliateMembership, resumeSuspendedAffiliateMembership, suspendAffiliateMembership } from "@/lib/affiliates/service";

const value=(form:FormData,key:string)=>String(form.get(key)??"").trim();
const messages:Record<string,string>={AFFILIATE_MEMBERSHIP_TRANSITION_DENIED:"That membership transition is not allowed.",AFFILIATE_MEMBERSHIP_ENDED:"Ended memberships cannot be reactivated.",AFFILIATE_TERMINATION_REASON_REQUIRED:"A termination reason is required."};
function fail(error:unknown):never{const message=error instanceof Error&&messages[error.message]?messages[error.message]:"Affiliate could not be updated. Please try again.";redirect(`/platform/affiliates?affiliateError=${encodeURIComponent(message)}`);}
async function audit(actorId:string,action:string,entityId:string,metadata:Record<string,unknown>){await prisma.auditLog.create({data:{workspaceId:null,actorId,action,entityType:"AffiliateMembership",entityId,metadata:{scope:"PLATFORM",actorType:"PLATFORM_OPERATOR",correlationId:randomUUID(),...metadata}}});}
export async function transitionMembershipAction(form:FormData){const operator=await requireOperatorAccess();const id=value(form,"membershipId"),action=value(form,"action"),reason=value(form,"reason");try{const previous=await prisma.affiliateMembershipPeriod.findUniqueOrThrow({where:{id},include:{code:true}});const next=action==="SUSPEND"?await suspendAffiliateMembership(id):action==="RESUME"?await resumeSuspendedAffiliateMembership(id):action==="END"?await endAffiliateMembership(id,reason):(()=>{throw new Error("AFFILIATE_MEMBERSHIP_TRANSITION_DENIED")})();await audit(operator.user.id,`AFFILIATE_MEMBERSHIP_${action}`,id,{participantId:previous.participantId,membershipPeriodId:id,codeId:previous.code?.id,previous:{status:previous.status,codeStatus:previous.code?.status},next:{status:next.status,endedAt:next.endedAt}});if(action==="END"&&previous.code)await audit(operator.user.id,"AFFILIATE_CODE_RETIRED",previous.code.id,{participantId:previous.participantId,membershipPeriodId:id,codeId:previous.code.id,previous:{status:previous.code.status},next:{status:"RETIRED"}});}catch(error){fail(error)}revalidatePath("/platform/affiliates");redirect("/platform/affiliates?affiliateMessage=Membership%20updated.")}
