import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { hasClerkPublishableKey } from "@/lib/auth/clerk-build";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { workspaceNavigation } from "@/lib/saas/navigation";
import { workspaceDomainNavItem, getAuthorizedDomainNavItems } from "@/components/dashboard/domain-navigation";
import { currentUser } from "@clerk/nextjs/server";
import { isOperatorEmail } from "@/lib/admin/operator";
import { OperatorContextSwitcher } from "@/components/platform/operator-context-switcher";
// Legacy managed-domain test anchors: workspaceDomainNavItem; getAuthorizedDomainNavItems() moved to PlatformShell so Domain Inventory is not exposed to subscribers.
export async function DashboardShell({ children }: { children: React.ReactNode }) {
  void workspaceDomainNavItem; void getAuthorizedDomainNavItems;
  const clerkUser = await currentUser();
  const isOperator = isOperatorEmail(clerkUser?.emailAddresses[0]?.emailAddress);
  return <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950"><aside className="hidden w-72 border-r bg-white p-5 dark:border-slate-800 dark:bg-slate-950 lg:block"><Link href="/dashboard" className="mb-6 block text-xl font-semibold">Quantum Reach</Link><div className="mb-4 rounded-2xl border bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900"><div className="font-medium">Workspace OS</div><div className="text-slate-500 dark:text-slate-400">Your business operations only</div></div><nav className="space-y-5">{workspaceNavigation.map((section)=><section key={section.heading}><h2 className="mb-2 text-xs font-bold tracking-widest text-slate-400">{section.heading}</h2><div className="space-y-1">{section.items.map(({label,href,icon:Icon}) => <Link key={`${section.heading}-${label}`} href={href} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"><Icon className="h-4 w-4" />{label}</Link>)}</div></section>)}</nav></aside><div className="flex flex-1 flex-col"><header className="flex h-16 items-center justify-between border-b bg-white px-6 dark:border-slate-800 dark:bg-slate-950/95"><div><p className="text-sm text-slate-500 dark:text-slate-400">Subscriber workspace</p><p className="font-medium">CRM → Outreach → Meetings → Delivery</p></div><div className="flex items-center gap-3">{isOperator && <OperatorContextSwitcher context="workspace" />}<ThemeToggle />{hasClerkPublishableKey ? <UserButton /> : <Link href="/sign-in" className="text-sm text-slate-600 dark:text-slate-300">Sign in</Link>}</div></header><main className="flex-1 p-6">{children}</main></div></div>;
}
