import Link from "next/link";
import { PublicLayout } from "@/components/public-layout/layout";

export const metadata = { title: "Pricing · Quantum Reach" };

const plans = [
  {
    name: "Launch",
    price: "$297/month",
    setup: "$750 setup",
    domains: 2,
    mailboxes: 6,
    sends: "4,500",
  },
  {
    name: "Growth",
    price: "$597/month",
    setup: "$1,500 setup",
    domains: 5,
    mailboxes: 15,
    sends: "11,500",
    recommended: true,
  },
  {
    name: "Scale",
    price: "$997/month",
    setup: "$2,500 setup",
    domains: 10,
    mailboxes: 30,
    sends: "23,000",
  },
];

export default function PricingPage() {
  return (
    <PublicLayout>
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h1 className="text-4xl font-semibold text-slate-950">Plans</h1>
        <p className="mt-3 max-w-2xl text-slate-700">
          One complete package: the Quantum Reach platform plus managed outreach capacity. Every plan includes
          CRM, campaigns, meetings, and delivery tools. Sending volume is available after domain verification and
          warm-up.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-3xl border bg-white p-6 shadow-sm ${plan.recommended ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200"}`}
            >
              {plan.recommended ? <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Recommended</p> : null}
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">{plan.name}</h2>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{plan.price}</p>
              <p className="text-sm text-slate-600">{plan.setup}</p>
              <ul className="mt-5 space-y-2 text-sm text-slate-700">
                <li>Complete platform included</li>
                <li>
                  Plan allows {plan.domains} sending domain{plan.domains === 1 ? "" : "s"}
                </li>
                <li>{plan.mailboxes} mailboxes / senders</li>
                <li>About {plan.sends} mature monthly sends</li>
              </ul>
              <Link className="mt-6 inline-flex rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white" href="/start">
                Get started
              </Link>
            </article>
          ))}
        </div>
        <p className="mt-8 text-sm text-slate-700">
          Questions?{" "}
          <a className="font-semibold underline" href="mailto:support@quantumreach.app">
            support@quantumreach.app
          </a>
        </p>
      </section>
    </PublicLayout>
  );
}
