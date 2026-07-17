import { redirect } from "next/navigation";
import { safeAffiliateRedirect } from "@/lib/saas-commerce/affiliate";
export default function ReferralPage({ params }: { params: { affiliateCode: string } }) { redirect(safeAffiliateRedirect(params.affiliateCode)); }
