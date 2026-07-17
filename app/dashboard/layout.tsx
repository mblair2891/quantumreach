import { DashboardShell } from "@/components/dashboard/shell";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireSubscriberWorkspaceAccess();
  return <DashboardShell>{children}</DashboardShell>;
}
