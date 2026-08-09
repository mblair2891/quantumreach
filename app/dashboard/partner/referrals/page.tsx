import { requireUserProfile } from "@/lib/auth/rbac";
import { CopyValueButton } from "@/components/dashboard/copy-value-button";
import { getPartnerReferralDashboard } from "@/lib/affiliates/partner-referrals";
import { moneyCents } from "@/lib/affiliates/expected-fee";
import { DEFAULT_HOLD_DAYS } from "@/lib/affiliates/program-config";

export default async function PartnerReferralsPage() {
  const user = await requireUserProfile();
  const dashboard = await getPartnerReferralDashboard(user.id);

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-50">Your referrals</h1>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
          Share your referral link, track referred signups, and see internal expected balances. Bank transfers are not
          automated in private beta — available amounts are paid manually by Quantum Reach operators.
        </p>
      </header>

      {dashboard.code && dashboard.referralLink ? (
        <section className="max-w-3xl space-y-4 rounded-xl border border-slate-300 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-slate-800 dark:text-slate-100">
            <strong>Membership status:</strong> {dashboard.membershipStatus ?? "—"}
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-200">
            <strong>Fee rule:</strong> {dashboard.rateLabel}
            {" · "}
            Hold period: <strong>{dashboard.holdDays} day(s)</strong>
            {dashboard.holdDays === DEFAULT_HOLD_DAYS ? " (platform default when unset is 14 days)" : ""}. Expected
            paid-out date = activation date + hold days.
          </p>
          {!dashboard.programEnabled ? (
            <p
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
            >
              The affiliate program is currently disabled by the platform operator. Existing history remains visible.
            </p>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="referral-code">
              Referral code
            </label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <input
                id="referral-code"
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-950 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                readOnly
                value={dashboard.code}
              />
              <CopyValueButton value={dashboard.code} label="Copy" />
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
                value={dashboard.referralLink}
              />
              <CopyValueButton value={dashboard.referralLink} label="Copy" />
            </div>
          </div>
        </section>
      ) : (
        <p
          role="status"
          className="max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          No active referral code is available. Affiliate membership is created automatically when paid subscriber access
          is activated. Complimentary grants do not create affiliate membership.
        </p>
      )}

      <section className="grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Referred signups</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-50">{dashboard.referredCount}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Pending balance</p>
          <p className="mt-2 text-3xl font-semibold text-amber-950 dark:text-amber-50">{dashboard.pendingTotalLabel}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950">
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Available balance</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-950 dark:text-emerald-50">
            {dashboard.availableTotalLabel}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Paid (recorded)</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-50">{dashboard.paidTotalLabel}</p>
        </div>
      </section>

      <section className="max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Referral activity</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Expected paid-out date is activation + {dashboard.holdDays} hold day(s). Status moves Pending → Available
            after that date; Paid means an operator recorded a manual payout (no automatic bank transfer).
          </p>
        </div>
        {dashboard.rows.length === 0 ? (
          <p className="p-5 text-sm text-slate-600 dark:text-slate-300">
            No referred activations yet. Paid and simulated-paid activations with a valid referral appear here.
            Complimentary activations are not commissionable.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Referred</th>
                  <th className="px-4 py-3 font-semibold">Package</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Expected fee</th>
                  <th className="px-4 py-3 font-semibold">Expected paid out</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-100">
                      {row.date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{row.referredLabel}</td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{row.packageName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          row.status === "AVAILABLE"
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                            : row.status === "PENDING"
                              ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100"
                              : "rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-800 dark:bg-slate-700 dark:text-slate-100"
                        }
                      >
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-950 dark:text-slate-50">
                      {moneyCents(row.expectedFeeCents)}
                    </td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{row.expectedPaidOutLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
