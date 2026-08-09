import Link from "next/link";
import { requireOperatorAccess } from "@/lib/admin/operator";
import { getAffiliateProgramConfig, formatBpsAsPercent } from "@/lib/affiliates/program-config";
import { updateAffiliateProgramSettingsAction } from "./actions";

export default async function AffiliateProgramSettingsPage({
  searchParams,
}: {
  searchParams?: { error?: string; saved?: string };
}) {
  await requireOperatorAccess();
  const config = await getAffiliateProgramConfig();

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-sm font-medium text-slate-300">
          <Link href="/platform/affiliates" className="underline hover:text-white">
            Affiliates
          </Link>{" "}
          · Program settings
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Affiliate program settings</h1>
        <p className="mt-2 text-slate-200">
          Control program enablement and the expected-fee rules shown on partner referral dashboards. This does not
          execute payouts.
        </p>
      </header>

      {searchParams?.error ? (
        <p role="alert" className="rounded-lg border border-red-700 bg-red-950/50 p-3 text-sm text-red-100">
          {searchParams.error}
        </p>
      ) : null}
      {searchParams?.saved ? (
        <p role="status" className="rounded-lg border border-emerald-700 bg-emerald-950/40 p-3 text-sm text-emerald-100">
          Settings saved. Partner dashboards use these values for expected fee display.
        </p>
      ) : null}

      <section className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-50">
        <h2 className="font-semibold">Current defaults</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-200">
          <li>Program: {config.enabled ? "Enabled" : "Disabled"}</li>
          <li>First payment rate: {formatBpsAsPercent(config.firstPaymentRateBps)}</li>
          <li>Recurring rate (display): {formatBpsAsPercent(config.recurringRateBps)}</li>
          <li>Setup fees commissionable: {config.setupFeesCommissionable ? "Yes" : "No"}</li>
          <li>Hold days before Active label: {config.holdDays}</li>
        </ul>
      </section>

      <form action={updateAffiliateProgramSettingsAction} className="space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-6">
        <label className="flex items-center gap-3 text-sm text-slate-100">
          <input type="checkbox" name="enabled" value="on" defaultChecked={config.enabled} className="h-4 w-4" />
          Affiliate program enabled
        </label>

        <label className="block text-sm font-medium text-slate-100">
          First payment commission rate (basis points)
          <input
            name="firstPaymentRateBps"
            type="number"
            min={0}
            max={10000}
            required
            defaultValue={config.firstPaymentRateBps}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-50"
          />
          <span className="mt-1 block text-xs font-normal text-slate-300">
            2000 = 20%. Applied to the commissionable first-payment basis.
          </span>
        </label>

        <label className="block text-sm font-medium text-slate-100">
          Recurring commission rate (basis points, display)
          <input
            name="recurringRateBps"
            type="number"
            min={0}
            max={10000}
            required
            defaultValue={config.recurringRateBps}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-50"
          />
          <span className="mt-1 block text-xs font-normal text-slate-300">
            Shown in calculation notes; partner v1 expected fee uses first payment primarily.
          </span>
        </label>

        <label className="flex items-center gap-3 text-sm text-slate-100">
          <input
            type="checkbox"
            name="setupFeesCommissionable"
            value="on"
            defaultChecked={config.setupFeesCommissionable}
            className="h-4 w-4"
          />
          Setup / implementation fees are commissionable
        </label>

        <label className="block text-sm font-medium text-slate-100">
          Hold days (Pending → Active label)
          <input
            name="holdDays"
            type="number"
            min={0}
            max={365}
            required
            defaultValue={config.holdDays}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-50"
          />
          <span className="mt-1 block text-xs font-normal text-slate-300">
            0 = label as Active (expected) immediately. Does not pay out funds.
          </span>
        </label>

        <label className="block text-sm font-medium text-slate-100">
          Operator notes (optional)
          <textarea
            name="notes"
            rows={3}
            defaultValue={config.notes ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-50"
            placeholder="Internal notes about program policy"
          />
        </label>

        <button type="submit" className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-500">
          Save affiliate settings
        </button>
      </form>
    </main>
  );
}
