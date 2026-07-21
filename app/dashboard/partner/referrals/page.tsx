import { requirePartnerAccess } from "@/lib/saas/partner-access";
import { PlatformPageTemplate } from "@/components/platform/page-template";
export default async function Page(){await requirePartnerAccess();return <PlatformPageTemplate title="Partner Referrals" description="Workspace-scoped subscriber partner center view." items={['Click', 'Signup', 'Checkout started', 'Paid conversion', 'Active recurring customer', 'Attribution expiration', 'First/last-touch policy']}/>}
