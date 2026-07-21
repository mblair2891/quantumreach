import { PlatformPageTemplate } from "@/components/platform/page-template";
import { requireWhiteLabelAccess } from "@/lib/saas/partner-access";
export default async function Page(){ await requireWhiteLabelAccess(); return <PlatformPageTemplate title="Partner Branding" description="Workspace-scoped subscriber partner center view." items={['Brand name', 'Logo', 'Primary color', 'Secondary color', 'Favicon', 'Support email', 'Support URL', 'Login display name', 'Portal display name', 'Scheduling brand name', 'Proposal brand name', 'Contract brand name']}/>; }
