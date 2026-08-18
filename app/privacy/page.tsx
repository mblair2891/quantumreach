import { PublicLayout } from "@/components/public-layout/layout";

export const metadata = { title: "Privacy Policy · Quantum Reach" };

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl space-y-5 px-6 py-16 text-slate-700">
        <h1 className="text-4xl font-semibold text-slate-950">Privacy Policy</h1>
        <p>Last updated August 17, 2026.</p>
        <p>
          Quantum Reach (“we”) provides training, software, and managed outreach infrastructure. This policy
          describes how we handle information when you visit quantumreach.app, create an account, or pay for a
          subscription.
        </p>
        <h2 className="text-2xl font-semibold text-slate-950">Information we collect</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Account details such as name, email, and password (stored hashed).</li>
          <li>Business profile and workspace data you enter (CRM, campaigns, documents).</li>
          <li>Billing details processed by Stripe. We do not store full card numbers.</li>
          <li>Technical logs needed to operate the service (IP, timestamps, error reports).</li>
        </ul>
        <h2 className="text-2xl font-semibold text-slate-950">How we use it</h2>
        <p>
          We use this information to provide the product, process payments, send transactional mail from
          noreply@quantumreach.app, prevent abuse, and improve reliability. We do not sell personal information.
        </p>
        <h2 className="text-2xl font-semibold text-slate-950">Sharing</h2>
        <p>
          We share data with processors that help us run the service, including Stripe (payments), Amazon SES
          (email), and our hosting provider. Customer outbound email is sent from the customer’s sending domain,
          not from Quantum Reach system addresses.
        </p>
        <h2 className="text-2xl font-semibold text-slate-950">Contact</h2>
        <p>
          Questions:{" "}
          <a className="font-semibold underline" href="mailto:support@quantumreach.app">
            support@quantumreach.app
          </a>
          .
        </p>
      </article>
    </PublicLayout>
  );
}
