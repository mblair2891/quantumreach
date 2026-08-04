import { redirect } from "next/navigation";
import { captureAffiliateAttribution, resolveAffiliateCode } from "@/lib/affiliates/service";
import { saveDraftSelection } from "@/lib/customer-journey/acquisition-draft";
import { trackFunnelEvent } from "@/lib/customer-journey/funnel";

export default async function ReferralPage({params}:{params:{affiliateCode:string}}) {
  const resolved=await resolveAffiliateCode(params.affiliateCode);
  if(!resolved)redirect("/start?referral=invalid");
  const session=await saveDraftSelection({returnRoute:"/start"});
  const attribution=await captureAffiliateAttribution({code:params.affiliateCode,acquisitionSessionId:session.id,sourceMetadata:{entryPath:"/r/[affiliateCode]"}});
  if(!attribution)redirect("/start?referral=invalid");
  await trackFunnelEvent("AFFILIATE_REFERRAL_CAPTURED",{acquisitionSessionId:session.id,metadata:{source:"affiliate_link"}});
  redirect("/start");
}
