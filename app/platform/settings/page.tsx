import Link from "next/link";
import { PlatformPageTemplate } from "@/components/platform/page-template";

export default function Page() {
  return (
    <div className="space-y-6">
      <PlatformPageTemplate
        title="Platform settings"
        description="Operator-only safe summaries for platform settings."
        items={["Safe summary", "Status", "Actions"]}
      />
      <section className="rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-50">
        <h2 className="font-semibold">Partner program</h2>
        <p className="mt-2 text-sm text-slate-200">
          Configure affiliate enablement, expected-fee rates, setup-fee commissionability, and hold labels.
        </p>
        <Link
          href="/platform/affiliates/settings"
          className="mt-4 inline-flex rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
        >
          Open affiliate program settings
        </Link>
      </section>
    </div>
  );
}
