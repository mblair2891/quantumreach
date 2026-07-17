import { calculateCommissionCents, isSelfReferral } from "./platform-model";
export const ATTRIBUTION_COOKIE = "qr_affiliate_attribution";
export const ATTRIBUTION_DAYS = 60;
export const ATTRIBUTION_POLICY = "Last-touch affiliate attribution is stored for 60 days; self-referrals and duplicate paid conversions are blocked server-side.";
export function safeAffiliateRedirect(code: string) { return `/sign-up?affiliate=${encodeURIComponent(code)}`; }
export function canAttribute(input:{affiliateUserId:string; prospectUserId?:string|null; existingConversion?:boolean}) { return !isSelfReferral(input.affiliateUserId, input.prospectUserId) && !input.existingConversion; }
export function commissionForSuccessfulPayment(grossCents:number, rateBps = 2000) { return calculateCommissionCents({ type: "PERCENT_RECURRING", grossCents, rateBps }); }
export function reversalForRefund(originalCommissionCents:number, refundedGrossCents:number, originalGrossCents:number) { if (originalGrossCents <= 0) return 0; return -Math.min(originalCommissionCents, Math.floor((originalCommissionCents * refundedGrossCents) / originalGrossCents)); }
