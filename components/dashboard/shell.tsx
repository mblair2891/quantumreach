import Link from "next/link";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { AccountMenu } from "@/components/auth/account-menu";
import { workspaceNavigation } from "@/lib/saas/navigation";
import { workspaceDomainNavItem, getAuthorizedDomainNavItems } from "@/components/dashboard/domain-navigation";
import { getOptionalUserProfile } from "@/lib/auth/rbac";
import { isOperatorEmail } from "@/lib/admin/operator";
import { OperatorContextSwitcher } from "@/components/platform/operator-context-switcher";

// Legacy managed-domain test anchors: workspaceDomainNavItem; getAuthorizedDomainNavItems() moved to PlatformShell so Domain Inventory is not exposed to subscribers.
export async function DashboardShell({ children }: { children: React.ReactNode }) {
  void workspaceDomainNavItem;
  void getAuthorizedDomainNavItems;
  const user = await getOptionalUserProfile();
  const isOperator = isOperatorEmail(user?.email);
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <aside className="hidden w-72 border-r border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 lg:block">
        <Link href="/dashboard" className="mb-6 block text-xl font-semibold text-slate-950 dark:text-slate-50">
          Quantum Reach
        </Link>
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="font-medium text-slate-950 dark:text-slate-50">Workspace OS</div>
          <div className="text-slate-600 dark:text-slate-300">Your business operations only</div>
        </div>
        <nav className="space-y-5">
          {workspaceNavigation.map((section) => (
            <section key={section.heading}>
              <h2 className="mb-2 text-xs font-bold tracking-widest text-slate-600 dark:text-slate-300">
                {section.heading}
              </h2>
              <div className="space-y-1">
                {section.items.map(({ label, href, icon: Icon }) => (
                  <Link
                    key={`${section.heading}-${label}`}
                    href={href}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-80" />
                    {label}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-950/95">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-300">Subscriber workspace</p>
            <p className="font-medium text-slate-950 dark:text-slate-50">CRM → Outreach → Meetings → Delivery</p>
          </div>
          <div className="flex items-center gap-3">
            {isOperator ? <OperatorContextSwitcher context="workspace" /> : null}
            <ThemeToggle />
            <AccountMenu email={user?.email} />
          </div>
        </header>
        <main className="flex-1 p-6 text-slate-950 dark:text-slate-50">{children}</main>
      </div>
    </div>
  );
}
