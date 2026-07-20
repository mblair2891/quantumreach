import Link from "next/link";

export function FunnelShell({ children }: { children: React.ReactNode }) {
  return <main className="funnel-page min-h-screen overflow-hidden"><header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8"><Link href="/start" className="flex items-center gap-2 font-semibold tracking-tight text-slate-950"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-sm text-white">Q</span>Quantum Reach</Link><Link className="text-sm font-medium text-slate-600 transition hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-4" href="/sign-in">Sign in</Link></header>{children}</main>;
}
