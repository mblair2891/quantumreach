import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireUserProfile } from "@/lib/auth/rbac";

/** Partner hub for automatic affiliate membership (paid subscribers). Uses membership periods; not the legacy partner env gate. */
export default async function Page() {
  const user = await requireUserProfile();
  const participant = await prisma.affiliateParticipant.findUnique({
    where: { userId: user.id },
    include: {
      memberships: {
        where: { status: { in: ["ACTIVE", "SUSPENDED"] } },
        include: { code: true },
        take: 1,
        orderBy: { startedAt: "desc" },
      },
    },
  });
  const membership = participant?.memberships[0];
  const active = membership?.status === "ACTIVE" && membership.code?.status === "ACTIVE";

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-50">Partner Center</h1>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
          Active paid subscribers automatically receive an affiliate membership and referral code. Share your link to attribute new acquisitions. Commission dashboards and payouts are deferred past private beta.
        </p>
      </header>

      {active ? (
        <section className="max-w-2xl space-y-3 rounded-xl border border-slate-300 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Membership status: <strong className="text-slate-950 dark:text-slate-50">{membership!.status}</strong>
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Your referral code is ready. Open the referral page to copy the code and public link.
          </p>
          <Link
            className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            href="/dashboard/partner/referrals"
          >
            View referral code and link
          </Link>
        </section>
      ) : (
        <p
          role="status"
          className="max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          No active referral membership yet. Affiliate membership is created automatically when paid subscriber access is activated (simulated test payment, Stripe, or operator manual paid clearance). Complimentary grants do not create affiliate membership.
        </p>
      )}

      <section className="max-w-2xl rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
        <h2 className="font-semibold text-slate-950 dark:text-slate-50">Private beta scope</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>Referral code generation and public <code className="text-slate-900 dark:text-slate-100">/r/[code]</code> attribution</li>
          <li>Access-end retires the code; resubscription creates a new period and code</li>
          <li>Commissions, holds, clawbacks, and payouts remain out of private-beta scope</li>
        </ul>
      </section>
    </main>
  );
}
