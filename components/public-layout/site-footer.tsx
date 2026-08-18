import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white/80 px-5 py-8 text-sm text-slate-700">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Quantum Reach. All rights reserved.</p>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          <Link className="underline-offset-2 hover:underline" href="/pricing">
            Pricing
          </Link>
          <Link className="underline-offset-2 hover:underline" href="/contact">
            Contact
          </Link>
          <Link className="underline-offset-2 hover:underline" href="/privacy">
            Privacy
          </Link>
          <Link className="underline-offset-2 hover:underline" href="/terms">
            Terms
          </Link>
          <a className="underline-offset-2 hover:underline" href="mailto:support@quantumreach.app">
            support@quantumreach.app
          </a>
        </nav>
      </div>
    </footer>
  );
}
