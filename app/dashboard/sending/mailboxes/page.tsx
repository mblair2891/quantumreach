import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { prisma } from "@/lib/db/prisma";
import { createMailboxAction } from "./actions";
import { isSesIdentityVerified } from "@/lib/sending-infrastructure/gates";
import { getWorkspaceEffectiveEntitlements } from "@/lib/sending-infrastructure/operational";
import { ENTITLEMENT_KEYS } from "@/lib/sending-infrastructure/catalog";
import { displaySubscriberMailboxStatus } from "@/lib/customer-journey/subscriber-copy";
import { CreateMailboxForm } from "@/components/dashboard/create-mailbox-form";

export default async function Page({
  searchParams,
}: {
  searchParams?: { error?: string; created?: string };
}) {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  const [mailboxes, domains, entitlements, profiles] = await Promise.all([
    prisma.managedMailbox.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" } }),
    prisma.managedDomain.findMany({
      where: {
        OR: [{ workspaceId: workspace.id }, { assignments: { some: { workspaceId: workspace.id, status: "ACTIVE" } } }],
      },
      include: { sesIdentity: true },
    }),
    getWorkspaceEffectiveEntitlements(workspace.id),
    prisma.mailboxWarmupProfile.findMany({ where: { workspaceId: workspace.id } }),
  ]);
  const allowed = Number(entitlements.effective[ENTITLEMENT_KEYS.MAILBOX_ALLOWANCE] || 0);
  const atCap = allowed > 0 && mailboxes.length >= allowed;
  const verifiedDomains = domains.filter(
    (domain) =>
      isSesIdentityVerified(domain.sesIdentity?.verificationStatus) &&
      isSesIdentityVerified(domain.sesIdentity?.dkimStatus),
  );

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-50">Mailboxes</h1>
        <p className="mt-2 text-slate-700 dark:text-slate-300">
          Plan allows {allowed} mailbox{allowed === 1 ? "" : "es"} · {mailboxes.length} used.
        </p>
      </header>

      {searchParams?.error ? (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          {searchParams.error}
        </p>
      ) : null}
      {searchParams?.created ? (
        <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
          Mailbox created. Warm-up starts automatically. A hosted inbox is not set up in this environment yet.
        </p>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50">
        <h2 className="text-lg font-semibold">Create a mailbox</h2>
        {verifiedDomains.length === 0 ? (
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Verify a sending domain first, then you can create a mailbox.{" "}
            <a className="font-semibold underline" href="/dashboard/sending/domains">
              Sending domains
            </a>
          </p>
        ) : (
          <CreateMailboxForm
            action={createMailboxAction}
            domains={verifiedDomains.map((domain) => ({ id: domain.id, domainName: domain.domainName }))}
            atCap={atCap}
          />
        )}
      </section>

      {mailboxes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-slate-700 dark:border-slate-700 dark:text-slate-300">
          No mailboxes yet. Create one on a verified domain to start warm-up.
        </p>
      ) : (
        mailboxes.map((mailbox) => {
          const profile = profiles.find((item) => item.managedMailboxId === mailbox.id);
          const status = displaySubscriberMailboxStatus({
            status: mailbox.status,
            provisioningStatus: mailbox.provisioningStatus,
            lifecycleState: profile?.lifecycleState,
          });
          const awaitingInbox =
            mailbox.provisioningStatus === "PENDING_PROVIDER_CONFIGURATION" ||
            mailbox.provisioningStatus === "SES_SENDER_ONLY" ||
            mailbox.provider === "DISABLED";
          return (
            <article
              key={mailbox.id}
              className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{mailbox.emailAddress}</h2>
                  {mailbox.displayName ? (
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{mailbox.displayName}</p>
                  ) : null}
                </div>
                <p className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold dark:bg-slate-800">
                  {status.label}
                </p>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">{status.detail}</p>
              {awaitingInbox ? (
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  This is a sending address. It is not a full hosted inbox yet.
                </p>
              ) : null}
              {profile?.currentDailyLimit ? (
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Daily send limit today: {profile.currentDailyLimit}
                </p>
              ) : null}
            </article>
          );
        })
      )}
    </main>
  );
}
