import Link from "next/link";
import { requireOperatorAccess } from "@/lib/admin/operator";
import { getPlatformAffiliateBalances } from "@/lib/affiliates/partner-referrals";
import { DEFAULT_HOLD_DAYS } from "@/lib/affiliates/program-config";
import { markAffiliatePayoutPaidAction } from "./actions";

export default async function PlatformPayoutsPage({
  searchParams,
}: {
  searchParams?: { error?: string; message?: string };
}) {
  await requireOperatorAccess();
  const balances = await getPlatformAffiliateBalances();

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white">Affiliate balances & payouts</h1>
          <p className="mt-2 max-w-3xl text-slate-200">
            Internal affiliate ledger only. Amounts become Available after the hold period (default{" "}
            {DEFAULT_HOLD_DAYS} days when unset). Marking Paid records a manual payout — it does not send bank
            transfers or Stripe Connect splits.
          </p>
        </div>
        <Link
          href="/platform/affiliates/settings"
          className="rounded-lg border border-slate-500 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-900"
        >
          Program settings
        </Link>
      </header>

      {searchParams?.error ? (
        <p role="alert" className="rounded-lg border border-red-700 bg-red-950/50 p-3 text-sm text-red-100">
          {searchParams.error}
        </p>
      ) : null}
      {searchParams?.message ? (
        <p role="status" className="rounded-lg border border-emerald-700 bg-emerald-950/40 p-3 text-sm text-emerald-100">
          {searchParams.message}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-amber-800 bg-amber-950/40 p-5">
          <p className="text-sm text-amber-100">Pending (in hold)</p>
          <p className="mt-2 text-3xl font-semibold text-white">{balances.pendingTotalLabel}</p>
        </div>
        <div className="rounded-xl border border-emerald-800 bg-emerald-950/40 p-5">
          <p className="text-sm text-emerald-100">Available (owed)</p>
          <p className="mt-2 text-3xl font-semibold text-white">{balances.availableTotalLabel}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
          <p className="text-sm text-slate-300">Paid (manual records)</p>
          <p className="mt-2 text-3xl font-semibold text-white">{balances.paidTotalLabel}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
        <div className="border-b border-slate-700 px-5 py-4">
          <h2 className="font-semibold text-white">Commissionable referrals</h2>
          <p className="mt-1 text-sm text-slate-300">
            Hold days: {balances.holdDays}. Owed total (available only): {balances.owedTotalLabel}.
          </p>
        </div>
        {balances.rows.length === 0 ? (
          <p className="p-5 text-sm text-slate-300">No commissionable affiliate referrals yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-100">
              <thead className="bg-slate-950 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">Affiliate</th>
                  <th className="px-4 py-3 font-semibold">Referred</th>
                  <th className="px-4 py-3 font-semibold">Package</th>
                  <th className="px-4 py-3 font-semibold">Fee</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Expected paid out</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {balances.rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-800">
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.affiliateName}</div>
                      <div className="text-xs text-slate-400">{row.affiliateEmail}</div>
                    </td>
                    <td className="px-4 py-3">{row.referredLabel}</td>
                    <td className="px-4 py-3">{row.packageName ?? "—"}</td>
                    <td className="px-4 py-3 font-medium">{row.expectedFeeLabel}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          row.status === "AVAILABLE"
                            ? "rounded-full bg-emerald-900 px-2 py-0.5 text-xs font-semibold text-emerald-100"
                            : row.status === "PENDING"
                              ? "rounded-full bg-amber-900 px-2 py-0.5 text-xs font-semibold text-amber-100"
                              : "rounded-full bg-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-100"
                        }
                      >
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "PAID" && row.paidOutAt
                        ? `Paid ${row.paidOutAt.toLocaleDateString()}`
                        : row.expectedPaidOutLabel}
                    </td>
                    <td className="px-4 py-3">
                      {row.canMarkPaid ? (
                        <form action={markAffiliatePayoutPaidAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <input type="hidden" name="attributionId" value={row.id} />
                          <input
                            name="note"
                            placeholder="Optional note"
                            className="rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                          />
                          <button
                            type="submit"
                            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
                          >
                            Mark paid
                          </button>
                        </form>
                      ) : row.status === "PAID" ? (
                        <span className="text-xs text-slate-400">Recorded</span>
                      ) : (
                        <span className="text-xs text-slate-400">In hold</span>
                      )}
                    </td>
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
