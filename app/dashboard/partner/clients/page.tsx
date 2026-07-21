import { requirePartnerAccess } from "@/lib/saas/partner-access";
import { PlatformPageTemplate } from "@/components/platform/page-template";
export default async function Page(){await requirePartnerAccess();return <PlatformPageTemplate title="Partner Clients" description="Workspace-scoped subscriber partner center view." items={['Company name', 'Signup date', 'Subscription plan', 'Subscription status', 'Provisioning status', 'Commission status', 'No CRM contacts or private workspace data']}/>}
