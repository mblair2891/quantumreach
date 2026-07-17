import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireWorkspaceAdmin } from "@/lib/auth/rbac";
import { getBillingConfig } from "@/lib/billing/config";

export default async function Page() {
  const { workspace, membership } = await requireWorkspaceAdmin();
  const billing = getBillingConfig();
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-slate-500">
          Workspace administration
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
          Review workspace profile, role boundaries, integration status,
          recording guidance, billing readiness, and safe diagnostics for{" "}
          {workspace.name}.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Workspace profile</CardTitle>
            <CardDescription>
              Basic tenant information and current role.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Name: <strong>{workspace.name}</strong>
            </p>
            <p>
              Slug: <strong>{workspace.slug}</strong>
            </p>
            <p>
              Your role: <strong>{String(membership.roleKey)}</strong>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>
              Zoom, storage, and AI setup guidance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/dashboard/settings/integrations/meetings">
                Open integrations center
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recording operations</CardTitle>
            <CardDescription>
              Local recording upload remains the supported production path.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">
            Upload Zoom local recordings after the meeting ends. M4A is
            supported. Zoom cloud recording import remains available in code but
            operationally deferred for accounts without cloud recording.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Billing</CardTitle>
            <CardDescription>
              {billing.configured
                ? "Stripe is configured."
                : "Private beta billing is disabled or not configured."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/dashboard/billing">Review billing</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Domain Registrant Profile</CardTitle>
            <CardDescription>
              The domain registrant is the legal holder of the domain
              registration. Enter accurate information for the person or
              organization that should own the domain.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <p>
              Workspace-owned domains require complete registrant details and
              explicit confirmation before purchase.
            </p>
            <p>
              Quantum Reach acts as reseller/service provider and manages DNS,
              SES, warmup, renewal, and billing infrastructure.
            </p>
            <Button asChild variant="outline">
              <Link href="/dashboard/settings/domain-registrant">
                Review registrant profile
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
