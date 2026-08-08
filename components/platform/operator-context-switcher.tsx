import Link from "next/link";

export function OperatorContextSwitcher({ context }: { context: "platform" | "workspace" }) {
  const label = context === "platform" ? "Quantum Reach Platform" : "My Workspace";
  return (
    <details className="relative text-sm">
      <summary
        className="cursor-pointer list-none rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        aria-label={`Switch context; current context is ${label}`}
      >
        {label} <span aria-hidden>▾</span>
      </summary>
      <nav
        aria-label="Operator context"
        className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <Link
          href="/platform"
          className="block rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Quantum Reach Platform
        </Link>
        <Link
          href="/dashboard"
          className="block rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          My Workspace
        </Link>
      </nav>
    </details>
  );
}
