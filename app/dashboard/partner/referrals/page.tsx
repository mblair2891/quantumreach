import { prisma } from "@/lib/db/prisma";
import { requireUserProfile } from "@/lib/auth/rbac";
import { CopyValueButton } from "@/components/dashboard/copy-value-button";

/** Permanent public production domain for shareable referral links. */
const REFERRAL_PUBLIC_ORIGIN = "https://www.quantumreach.app";

export default async function PartnerReferralsPage() {
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
  const available = membership?.status === "ACTIVE" && membership.code?.status === "ACTIVE";
  const code = available ? membership!.code!.code : "";
  const referralLink = available ? `${REFERRAL_PUBLIC_ORIGIN}/r/${code}` : "";

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-50">Your referral code</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Share your Quantum Reach referral link. Affiliate membership is included automatically with active paid
          subscriber access.
        </p>
      </header>
      {available ? (
        <section className="max-w-2xl space-y-4 rounded-xl border border-slate-300 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-slate-800 dark:text-slate-100">
            <strong>Membership status:</strong> {membership!.status}
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="referral-code">
              Referral code
            </label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <input
                id="referral-code"
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-950 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                readOnly
                value={code}
              />
              <CopyValueButton value={code} label="Copy" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="referral-link">
              Referral link
            </label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <input
                id="referral-link"
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                readOnly
                value={referralLink}
              />
              <CopyValueButton value={referralLink} label="Copy" />
            </div>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300">
            Use Copy to share your code or full link. The link always uses the permanent Quantum Reach domain. No
            internal account identifiers are included.
          </p>
        </section>
      ) : (
        <p
          role="status"
          className="max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          No active referral code is available. Referral access is available while your paid subscriber access and
          affiliate membership are active.
        </p>
      )}
    </main>
  );
}
