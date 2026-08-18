import Link from "next/link";
import { SiteFooter } from "./site-footer";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="qr-light-surface min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe,transparent_35%),#f8fafc] text-slate-950">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-semibold text-slate-950">
          Quantum Reach
        </Link>
        <nav className="flex gap-4 text-sm text-slate-700">
          <Link href="/pricing">Pricing</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/sign-in">Sign in</Link>
        </nav>
      </header>
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
