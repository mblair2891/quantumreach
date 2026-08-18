import { PublicLayout } from "@/components/public-layout/layout";

export const metadata = { title: "Contact · Quantum Reach" };

export default function ContactPage() {
  return (
    <PublicLayout>
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-semibold text-slate-950">Contact</h1>
        <p className="mt-4 text-slate-700">
          Quantum Reach is software and managed outreach infrastructure for agencies. For billing, setup, or
          support, email us and include your workspace or order id when you have one.
        </p>
        <p className="mt-6 text-lg font-semibold text-slate-950">
          <a className="underline" href="mailto:support@quantumreach.app">
            support@quantumreach.app
          </a>
        </p>
        <p className="mt-3 text-sm text-slate-700">We typically reply within one business day during private beta.</p>
      </section>
    </PublicLayout>
  );
}
