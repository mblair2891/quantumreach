import { redirect } from "next/navigation";
import { captureAffiliateAttribution, resolveAffiliateCode } from "@/lib/affiliates/service";
import { saveDraftSelection } from "@/lib/customer-journey/acquisition-draft";
import { trackFunnelEvent } from "@/lib/customer-journey/funnel";

/**
 * Public referral entry: store last-touch affiliate attribution on the acquisition
 * session cookie, then continue the normal package-selection funnel at /start.
 * Coupons are never created or applied here.
 */
export default async function ReferralPage({ params }: { params: { affiliateCode: string } }) {
  const rawCode = params.affiliateCode?.trim() ?? "";
  const resolved = await resolveAffiliateCode(rawCode);
  if (!resolved) redirect("/start?referral=invalid");

  // Ensures qr_acquisition cookie + session exist before attribution is attached.
  const session = await saveDraftSelection({ returnRoute: "/start" });
  const attribution = await captureAffiliateAttribution({
    code: rawCode,
    acquisitionSessionId: session.id,
    sourceMetadata: { entryPath: "/r/[affiliateCode]", code: rawCode },
  });
  if (!attribution) redirect("/start?referral=invalid");

  await trackFunnelEvent("AFFILIATE_REFERRAL_CAPTURED", {
    acquisitionSessionId: session.id,
    metadata: { source: "affiliate_link" },
  });

  redirect("/start?referral=captured");
}
