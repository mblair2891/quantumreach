import { DashboardShell } from "@/components/dashboard/shell";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireWorkspaceAccess();
  return <DashboardShell>{children}</DashboardShell>;
}
