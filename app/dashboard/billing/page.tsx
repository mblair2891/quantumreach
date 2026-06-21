import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getBillingConfig } from "@/lib/billing/config";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";

export default async function Page() {
  const { workspace } = await requireWorkspaceAccess();
  const billing = getBillingConfig();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-slate-500">Private beta billing</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Billing and plans</h1>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
          Manage the commercial status for {workspace.name}. Billing is feature-gated so core consulting workflows remain available when Stripe is not configured.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>{billing.configured ? "Stripe billing configured" : "Private beta billing disabled"}</CardTitle>
          <CardDescription>No secret values are displayed. Configure Stripe environment variables to enable checkout and portal actions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-xl border p-4 dark:border-slate-800"><strong>BILLING_ENABLED</strong><p>{billing.enabled ? "true" : "false"}</p></div>
          <div className="rounded-xl border p-4 dark:border-slate-800"><strong>Stripe secret</strong><p>{billing.hasSecret ? "Configured" : "Missing"}</p></div>
          <div className="rounded-xl border p-4 dark:border-slate-800"><strong>Webhook secret</strong><p>{billing.hasWebhook ? "Configured" : "Missing"}</p></div>
          <div className="rounded-xl border p-4 dark:border-slate-800"><strong>Price IDs</strong><p>{billing.priceIds.pro || billing.priceIds.team ? "At least one configured" : "Missing"}</p></div>
        </CardContent>
      </Card>
      <section className="grid gap-4 md:grid-cols-2">
        {[
          ["Pro", "Founder-led consulting workspace with meetings, analysis, reports, CRM, and knowledge operations."],
          ["Team", "Multi-seat operating workspace for delivery teams and admins."],
        ].map(([name, description]) => (
          <Card key={name}>
            <CardHeader><CardTitle>{name}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
            <CardContent><Button disabled={!billing.configured}>{billing.configured ? "Start checkout" : "Billing not configured"}</Button></CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
