import Link from "next/link";
import { Button } from "@/components/ui/button";

const pillars = ["Native CRM source of truth", "Structured diagnostics", "Auditable AI analysis", "ROI and executive reporting", "Implementation handoff"];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe,transparent_35%),#f8fafc]">
      <section className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-20 lg:flex-row lg:items-center">
        <div className="flex-1 space-y-8">
          <div className="inline-flex rounded-full border bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">Quantum Reach · Decision Intelligence OS</div>
          <h1 className="text-5xl font-semibold tracking-tight text-slate-950 lg:text-7xl">Move from lead signal to executable strategy.</h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-600">A multi-tenant SaaS foundation for CRM-led diagnostics, structured AI analysis, ROI modeling, executive reports, strategic roadmaps, proposals, and delivery handoff.</p>
          <div className="flex gap-3"><Button asChild><Link href="/sign-up">Start workspace</Link></Button><Button variant="outline" asChild><Link href="/sign-in">Sign in</Link></Button></div>
        </div>
        <div className="flex-1 rounded-3xl border bg-white p-6 shadow-2xl">
          <div className="mb-4 text-sm font-medium text-slate-500">Operating workflow</div>
          <div className="space-y-3">{pillars.map((pillar, index) => <div key={pillar} className="flex items-center gap-4 rounded-2xl border bg-slate-50 p-4"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm text-white">{index + 1}</span><span className="font-medium text-slate-800">{pillar}</span></div>)}</div>
        </div>
      </section>
    </main>
  );
}
