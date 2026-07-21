import { requirePartnerAccess } from "@/lib/saas/partner-access";
import { PlatformPageTemplate } from "@/components/platform/page-template";
export default async function Page(){await requirePartnerAccess();return <PlatformPageTemplate title="Partner Commissions" description="Workspace-scoped subscriber partner center view." items={['Commission date', 'Referred customer summary', 'Gross amount', 'Commission amount', 'Status', 'Reversal history']}/>}
