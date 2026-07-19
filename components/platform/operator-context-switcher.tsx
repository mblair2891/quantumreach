import Link from "next/link";

export function OperatorContextSwitcher({ context }: { context: "platform" | "workspace" }) {
  const label = context === "platform" ? "Quantum Reach Platform" : "My Workspace";
  return <details className="relative text-sm">
    <summary className="cursor-pointer list-none rounded-lg border border-slate-600 px-3 py-2 font-medium text-inherit hover:bg-slate-800" aria-label={`Switch context; current context is ${label}`}>{label} <span aria-hidden>▾</span></summary>
    <nav aria-label="Operator context" className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-100 shadow-xl">
      <Link href="/platform" className="block rounded-lg px-3 py-2 hover:bg-slate-800">Quantum Reach Platform</Link>
      <Link href="/dashboard" className="block rounded-lg px-3 py-2 hover:bg-slate-800">My Workspace</Link>
    </nav>
  </details>;
}
