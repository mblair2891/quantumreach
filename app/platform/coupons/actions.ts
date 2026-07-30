"use server";
import { randomUUID } from "node:crypto";
import { Prisma, type CommercialCoupon } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireOperatorAccess } from "@/lib/admin/operator";
import { normalizeCouponCode, validateCouponConfiguration } from "@/lib/commercial/coupons";

const supportedChargeTypes = ["PACKAGE_FIRST_MONTH","PACKAGE_RECURRING","IMPLEMENTATION_FEE","SETUP_PRIORITY_SURCHARGE","ADDON_ONE_TIME","ADDON_RECURRING"] as const;
const supportedPackages = ["LAUNCH_SENDER_PACKAGE","GROWTH_SENDER_PACKAGE","SCALE_SENDER_PACKAGE"] as const;
const value=(form:FormData,key:string)=>String(form.get(key)??"").trim();
const optionalInt=(form:FormData,key:string)=>{const raw=value(form,key);return raw?Number(raw):null};
const uniqueValues=(form:FormData,key:string)=>[...new Set(form.getAll(key).map(item=>String(item).trim()).filter(Boolean))];
const snapshot=(coupon:CommercialCoupon)=>({code:coupon.code,normalizedCode:coupon.normalizedCode,displayName:coupon.displayName,active:coupon.active,percentageOff:coupon.percentageOff,recurringDiscountMonths:coupon.recurringDiscountMonths,trialDays:coupon.trialDays,minimumOrderAmountCents:coupon.minimumOrderAmountCents,maximumTotalRedemptions:coupon.maximumTotalRedemptions,maximumRedemptionsPerCustomer:coupon.maximumRedemptionsPerCustomer,eligiblePackageKeys:coupon.eligiblePackageKeys,eligibleProductKeys:coupon.eligibleProductKeys,eligibleChargeTypes:coupon.eligibleChargeTypes,validFrom:coupon.validFrom,expiresAt:coupon.expiresAt,retiredAt:coupon.retiredAt,version:coupon.version});
const expectedMessages:Record<string,string>={COUPON_CODE_REQUIRED:"Coupon code is required.",COUPON_PERCENTAGE_INVALID:"Percentage must be between 1 and 100.",COUPON_RECURRING_DURATION_INVALID:"Recurring months must be a positive whole number.",COUPON_TRIAL_DAYS_INVALID:"Trial days must be a positive whole number.",COUPON_MINIMUM_INVALID:"Minimum order amount must be a non-negative whole number.",CHARGE_TYPES_REQUIRED:"Select at least one eligible charge type.",ELIGIBILITY_INVALID:"Coupon eligibility contains an invalid value."};
function safeMessage(error:unknown){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002")return "A coupon with this code already exists.";if(error instanceof Error&&expectedMessages[error.message])return expectedMessages[error.message];return "Coupon could not be saved. Please try again.";}
function errorRedirect(message:string):never{redirect(`/platform/coupons?couponError=${encodeURIComponent(message)}`);}

export async function saveCouponAction(form:FormData){
  const operator=await requireOperatorAccess();
  try {
    const id=value(form,"id"),code=value(form,"code"),percentageOff=Number(value(form,"percentageOff")),recurringDiscountMonths=optionalInt(form,"recurringDiscountMonths"),trialDays=optionalInt(form,"trialDays"),minimumOrderAmountCents=Number(value(form,"minimumOrderAmountCents")||0);
    validateCouponConfiguration({code,percentageOff,recurringDiscountMonths,trialDays,minimumOrderAmountCents});
    const eligibleChargeTypes=uniqueValues(form,"eligibleChargeTypes");
    if(!eligibleChargeTypes.length)throw new Error("CHARGE_TYPES_REQUIRED");
    if(eligibleChargeTypes.some(item=>!supportedChargeTypes.some(valid=>valid===item)))throw new Error("ELIGIBILITY_INVALID");
    const eligiblePackageKeys=value(form,"allPackages")==="true"?[]:uniqueValues(form,"eligiblePackageKeys");
    if(eligiblePackageKeys.some(item=>!supportedPackages.some(valid=>valid===item)))throw new Error("ELIGIBILITY_INVALID");
    const eligibleProductKeys=[...new Set(value(form,"eligibleProductKeys").split(",").map(item=>item.trim()).filter(Boolean))];
    if(eligibleProductKeys.some(item=>!/^[A-Z][A-Z0-9_]*$/.test(item)))throw new Error("ELIGIBILITY_INVALID");
    const data={code,normalizedCode:normalizeCouponCode(code),displayName:value(form,"displayName"),description:value(form,"description")||null,active:value(form,"active")==="true",validFrom:value(form,"validFrom")?new Date(value(form,"validFrom")):null,expiresAt:value(form,"expiresAt")?new Date(value(form,"expiresAt")):null,percentageOff,recurringDiscountMonths,trialDays,minimumOrderAmountCents,maximumTotalRedemptions:optionalInt(form,"maximumTotalRedemptions"),maximumRedemptionsPerCustomer:optionalInt(form,"maximumRedemptionsPerCustomer"),stripeCouponId:value(form,"stripeCouponId")||null,stripePromotionCodeId:value(form,"stripePromotionCodeId")||null,eligiblePackageKeys,eligibleProductKeys,eligibleChargeTypes};
    await prisma.$transaction(async tx=>{
      const previous=id?await tx.commercialCoupon.findUniqueOrThrow({where:{id}}):null;
      const coupon=id?await tx.commercialCoupon.update({where:{id},data:{...data,version:{increment:1}}}):await tx.commercialCoupon.create({data});
      await tx.auditLog.create({data:{workspaceId:null,actorId:operator.user.id,action:id?"COUPON_UPDATED":"COUPON_CREATED",entityType:"CommercialCoupon",entityId:coupon.id,metadata:{scope:"PLATFORM",actorType:"PLATFORM_OPERATOR",correlationId:randomUUID(),normalizedCode:coupon.normalizedCode,version:coupon.version,previous:previous?snapshot(previous):null,next:snapshot(coupon)}}});
    });
  } catch(error) {
    const message=safeMessage(error);
    if(message==="Coupon could not be saved. Please try again.")console.error("Platform coupon save failed",{actorId:operator.user.id,errorType:error instanceof Error?error.name:"Unknown"});
    errorRedirect(message);
  }
  revalidatePath("/platform/coupons");
  redirect("/platform/coupons?couponMessage=Coupon%20saved.");
}

export async function setCouponStateAction(form:FormData){
  const operator=await requireOperatorAccess();
  const id=value(form,"id"),action=value(form,"action");
  if(!["ACTIVATE","DEACTIVATE","RETIRE"].includes(action))errorRedirect("Unsupported coupon action.");
  try {
    await prisma.$transaction(async tx=>{
      const previous=await tx.commercialCoupon.findUniqueOrThrow({where:{id}});
      const coupon=await tx.commercialCoupon.update({where:{id},data:action==="RETIRE"?{active:false,retiredAt:new Date(),version:{increment:1}}:{active:action==="ACTIVATE",version:{increment:1}}});
      await tx.auditLog.create({data:{workspaceId:null,actorId:operator.user.id,action:`COUPON_${action}`,entityType:"CommercialCoupon",entityId:id,metadata:{scope:"PLATFORM",actorType:"PLATFORM_OPERATOR",correlationId:randomUUID(),normalizedCode:coupon.normalizedCode,version:coupon.version,previous:snapshot(previous),next:snapshot(coupon)}}});
    });
  } catch(error) {
    console.error("Platform coupon state change failed",{actorId:operator.user.id,errorType:error instanceof Error?error.name:"Unknown"});
    errorRedirect("Coupon could not be updated. Please try again.");
  }
  revalidatePath("/platform/coupons");
  redirect("/platform/coupons?couponMessage=Coupon%20updated.");
}
