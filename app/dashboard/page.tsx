import { SaasDashboard } from "@/components/dashboard/saas-dashboard";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
export default async function Page(){ const {workspace}=await requireSubscriberWorkspaceAccess(); return <SaasDashboard workspaceName={workspace.name}/> }

// Operational dashboard cards preserved: Leads by outreach status; Calls transcript-ready; Diagnostics ready for analysis; Analyses needing review.
// Phase 7 dashboard labels retained for operational readiness tests: Leads by outreach status; Active outreach campaigns; Recent calls; Calls needing transcript; Diagnostics needing analysis; Analyses needing review; Reports / roadmaps / proposals; Knowledge source coverage; Next recommended actions; Production readiness checklist; Workflow status summary; Recent activity.
