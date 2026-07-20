import Link from "next/link";

const system = [
  {
    number: "01",
    title: "Learn the System",
    copy: "Training and guidance for building and operating an AI-powered agency.",
  },
  {
    number: "02",
    title: "Run Your Business",
    copy: "Use Quantum Reach for CRM, campaigns, meetings, proposals, contracts, and client delivery.",
  },
  {
    number: "03",
    title: "Get Your Infrastructure",
    copy: "Choose managed domains and email infrastructure built into your setup flow.",
  },
];

function AgencySystemVisual() {
  return (
    <div className="relative mx-auto w-full max-w-xl" aria-label="The Quantum Reach agency system">
      <div className="absolute -inset-8 -z-10 rounded-full bg-indigo-300/30 blur-3xl" />
      <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-[0_28px_65px_-25px_rgba(15,23,42,.35)] sm:p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-sm font-bold text-white">Q</span>
            <div>
              <p className="text-sm font-semibold text-slate-950">Your agency system</p>
              <p className="text-xs text-slate-500">Built with Quantum Reach</p>
            </div>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Ready to launch</span>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
          <div className="absolute left-[16.5%] right-[16.5%] top-10 hidden h-px bg-indigo-200 sm:block" />
          {[
            ["Learn", "Training & guidance", "bg-indigo-600"],
            ["Build", "Software platform", "bg-violet-600"],
            ["Launch", "Managed infrastructure", "bg-slate-900"],
          ].map(([title, detail, color], index) => (
            <div key={title} className="relative rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-3">
              <span className={`mb-6 grid h-8 w-8 place-items-center rounded-full ${color} text-xs font-bold text-white sm:mx-auto`}>
                {index + 1}
              </span>
              <p className="font-semibold text-slate-950 sm:text-center">{title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-center">{detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl bg-slate-950 px-5 py-4 text-white">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-300">One connected path</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">From your first playbook to a supported agency operation.</p>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="funnel-page min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-slate-950">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-sm text-white">Q</span>
          Quantum Reach
        </Link>
        <Link className="text-sm font-medium text-slate-600 transition hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-4" href="/sign-in">
          Sign in
        </Link>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-10 sm:px-8 sm:pb-28 sm:pt-16 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
        <div>
          <p className="funnel-eyebrow">Build and run your AI-powered agency</p>
          <h1 className="funnel-title mt-5 max-w-3xl text-5xl font-semibold leading-[.98] sm:text-6xl lg:text-7xl">Learn the system. Launch your agency. Run it with Quantum Reach.</h1>
          <p className="funnel-copy mt-7 max-w-2xl text-base sm:text-lg">Quantum Reach combines training, software, and managed outreach infrastructure to help you build and operate a modern AI-powered marketing agency.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link className="funnel-primary w-full sm:w-auto" href="/start">Join Quantum Reach <span className="ml-2">→</span></Link>
            <Link className="funnel-secondary w-full sm:w-auto" href="/sign-in">Sign in</Link>
          </div>
          <p className="mt-5 text-sm text-slate-500">Start with the presentation. Your setup comes later, with guidance.</p>
        </div>
        <AgencySystemVisual />
      </section>

      <section className="border-y border-slate-200/80 bg-white/70">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="max-w-2xl">
            <p className="funnel-eyebrow">One practical path</p>
            <h2 className="funnel-title mt-3 text-3xl font-semibold leading-tight sm:text-4xl">Everything you need to move from agency ambition to agency operation.</h2>
            <p className="funnel-copy mt-4">A connected system for learning the model, operating the work, and setting up the outreach foundation behind it.</p>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 md:grid-cols-3">
            {system.map(({ number, title, copy }) => (
              <article key={number} className="bg-white p-7 sm:p-8">
                <span className="text-sm font-bold text-indigo-600">{number}</span>
                <h3 className="mt-8 text-xl font-semibold text-slate-950">{title}</h3>
                <p className="funnel-copy mt-3 text-sm">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="rounded-3xl bg-slate-950 px-6 py-12 text-center text-white sm:px-12 sm:py-16">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-300">Your next step</p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">See how Quantum Reach fits your agency journey.</h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-300">Watch the presentation to explore the training, platform, and managed infrastructure path.</p>
          <Link className="funnel-primary mt-8 w-full bg-white text-slate-950 shadow-none hover:bg-indigo-50 sm:w-auto" href="/start">Join Quantum Reach <span className="ml-2">→</span></Link>
        </div>
      </section>
    </main>
  );
}
