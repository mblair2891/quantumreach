import Link from "next/link";
import { AccountMenu } from "@/components/auth/account-menu";
import { platformNavigation } from "@/lib/saas/navigation";
import { getOptionalUserProfile } from "@/lib/auth/rbac";
import { OperatorContextSwitcher } from "@/components/platform/operator-context-switcher";

export async function PlatformShell({ children }: { children: React.ReactNode }) {
  const user = await getOptionalUserProfile();
  // Always dark chrome so theme-aware controls (account menu, etc.) stay readable.
  return (
    <div className="dark flex min-h-screen bg-slate-950 text-slate-50">
      <aside className="hidden w-80 border-r border-slate-800 bg-slate-950 p-5 lg:block">
        <Link href="/platform" className="mb-6 block text-xl font-semibold text-white">
          Quantum Reach Platform
        </Link>
        <nav className="space-y-5">
          {platformNavigation.map((s) => (
            <section key={s.heading}>
              <h2 className="mb-2 text-xs font-bold tracking-widest text-slate-400">{s.heading}</h2>
              <div className="space-y-1">
                {s.items.map(({ label, href, icon: Icon }) => (
                  <Link
                    key={`${s.heading}-${label}`}
                    href={href}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900 hover:text-white"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-slate-300" />
                    {label}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950 px-6">
          <div>
            <p className="text-sm text-slate-300">Platform operator console</p>
            <p className="font-medium text-white">Subscribers, commerce, infrastructure, partners</p>
          </div>
          <div className="flex items-center gap-3">
            <OperatorContextSwitcher context="platform" />
            <AccountMenu email={user?.email} />
          </div>
        </header>
        <main className="flex-1 p-6 text-slate-50">{children}</main>
      </div>
    </div>
  );
}
