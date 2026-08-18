import { PublicLayout } from "@/components/public-layout/layout";

export const metadata = { title: "Terms of Service · Quantum Reach" };

export default function TermsPage() {
  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl space-y-5 px-6 py-16 text-slate-700">
        <h1 className="text-4xl font-semibold text-slate-950">Terms of Service</h1>
        <p>Last updated August 17, 2026.</p>
        <p>
          These terms govern use of Quantum Reach at quantumreach.app. By creating an account or paying for a
          plan, you agree to them.
        </p>
        <h2 className="text-2xl font-semibold text-slate-950">The service</h2>
        <p>
          Quantum Reach provides agency software and optional managed sending infrastructure (domains, mailboxes,
          and outbound email capacity) subject to plan limits, verification, and warm-up. Features may be
          unavailable until required setup is complete.
        </p>
        <h2 className="text-2xl font-semibold text-slate-950">Accounts and billing</h2>
        <p>
          You are responsible for your workspace and the people you invite. Subscriptions and setup fees are
          billed through Stripe. Unused sending capacity does not roll over unless your order says otherwise.
        </p>
        <h2 className="text-2xl font-semibold text-slate-950">Acceptable use</h2>
        <p>
          You may not use Quantum Reach to send unlawful, deceptive, or unsolicited bulk email, or to violate
          anti-spam laws. We may pause sending or close a workspace that harms deliverability or other customers.
        </p>
        <h2 className="text-2xl font-semibold text-slate-950">Domains</h2>
        <p>
          A domain you connect remains yours. A domain we register for you is managed under your registrant
          profile and plan entitlement. Disconnecting a domain from Quantum Reach does not delete it at the
          registrar. Canceling a managed registration requires support.
        </p>
        <h2 className="text-2xl font-semibold text-slate-950">Contact</h2>
        <p>
          <a className="font-semibold underline" href="mailto:support@quantumreach.app">
            support@quantumreach.app
          </a>
        </p>
      </article>
    </PublicLayout>
  );
}
