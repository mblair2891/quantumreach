import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { prisma } from "@/lib/db/prisma";
import { getWorkspaceEffectiveEntitlements } from "@/lib/sending-infrastructure/operational";
import { ENTITLEMENT_KEYS } from "@/lib/sending-infrastructure/catalog";
import { enforceAllowance } from "@/lib/sending-infrastructure/readiness";
import { getDomainRegistrantProfile } from "@/lib/managed-domains/purchase";
import { validateRegistrantContact } from "@/lib/managed-domains/registrant";
import { displaySubscriberDomainStatus } from "@/lib/customer-journey/subscriber-copy";
import { lookupDnsHostHint } from "@/lib/sending-infrastructure/dns-observe";
import { canManageSendingDomains, isSubscriberRemovableByoDomain } from "@/lib/sending-infrastructure/byo-domain";
import { DnsRecordsTable } from "@/components/dashboard/dns-records-table";
import { ViewDnsRecords } from "@/components/dashboard/view-dns-records";
import { RemoveByoDomainForm } from "@/components/dashboard/remove-byo-domain-form";
import { getManagedPurchasingReadiness } from "@/lib/managed-domains/purchase";
import {
  addByoDomainAction,
  checkManagedDomainAction,
  purchaseManagedDomainAction,
  removeByoDomainAction,
  verifyByoDomainAction,
} from "./actions";

export default async function Page({
  searchParams,
}: {
  searchParams?: {
    error?: string;
    connected?: string;
    verified?: string;
    requested?: string;
    removed?: string;
    purchased?: string;
    check?: string;
    available?: string;
    price?: string;
  };
}) {
  const { workspace, membership } = await requireSubscriberWorkspaceAccess();
  const canRemoveDomains = canManageSendingDomains(String(membership.roleKey));
  const [domains, entitlements, profile] = await Promise.all([
    prisma.managedDomain.findMany({
      where: { OR: [{ workspaceId: workspace.id }, { assignments: { some: { workspaceId: workspace.id, status: "ACTIVE" } } }] },
      include: { dnsRecords: true, sesIdentity: true, warmupPlan: true },
      orderBy: { createdAt: "desc" },
    }),
    getWorkspaceEffectiveEntitlements(workspace.id),
    getDomainRegistrantProfile(workspace.id),
  ]);
  const hostHints = await Promise.all(
    domains.map((domain) => {
      const ses = (domain.sesIdentity?.verificationStatus ?? "").toUpperCase();
      const dkim = (domain.sesIdentity?.dkimStatus ?? "").toUpperCase();
      const verified = (ses === "VERIFIED" || ses === "SUCCESS") && (dkim === "VERIFIED" || dkim === "SUCCESS");
      return verified ? Promise.resolve(null) : lookupDnsHostHint(domain.domainName);
    }),
  );
  const allowed = Number(entitlements.effective[ENTITLEMENT_KEYS.MANAGED_DOMAIN_ALLOWANCE] || 0);
  const atCap = !enforceAllowance("domain", entitlements.effective, domains.length).allowed;
  const registrant = validateRegistrantContact(profile);
  const registrantReady = Boolean(registrant.complete && profile?.confirmedAt);
  const purchasing = getManagedPurchasingReadiness();

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-50">Sending domains</h1>
        <p className="mt-2 max-w-3xl text-slate-700 dark:text-slate-300">
          Connect a domain you own, or request a managed domain. We verify DNS and prepare sending. Your plan limits how
          many domains you can use.
        </p>
        {allowed > 0 ? (
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            Plan allows {allowed} domain{allowed === 1 ? "" : "s"} · {domains.length} connected.
          </p>
        ) : null}
      </header>

      {searchParams?.error ? (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          {searchParams.error}
        </p>
      ) : null}
      {searchParams?.connected ? (
        <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
          Domain connected. Publish the DNS records below, then verify.
        </p>
      ) : null}
      {searchParams?.verified ? (
        <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
          Domain verified. You can create a mailbox next.
        </p>
      ) : null}
      {searchParams?.purchased ? (
        <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
          Domain registered. Publish the DNS records below if they are not applied automatically, then verify.
        </p>
      ) : null}
      {searchParams?.removed ? (
        <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
          Domain removed from Quantum Reach. You can connect another domain if your plan has a free slot.
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <form
          action={addByoDomainAction}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50"
        >
          <h2 className="text-lg font-semibold">Bring your own domain</h2>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Use a domain you already own. A root domain like <span className="font-mono">example.com</span> is fine; an
            outbound host such as <span className="font-mono">mail.example.com</span> also works if that is what you
            send from.
          </p>
          <label className="grid gap-1 text-sm font-medium">
            Domain name
            <input
              name="domain"
              required
              placeholder="example.com"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          {atCap ? (
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Your plan is at its domain limit. Upgrade or remove a domain to connect another.
            </p>
          ) : null}
          <button className="rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={atCap}>
            Connect domain
          </button>
        </form>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50">
          <h2 className="text-lg font-semibold">Request a domain we’ll register for you</h2>
          {!purchasing.ready ? (
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {purchasing.reason} You can still connect a domain you own.
            </p>
          ) : !registrantReady ? (
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Complete your registrant profile first, then you can request a domain we’ll register for you.{" "}
              <a className="font-semibold underline" href="/dashboard/settings/domain-registrant">
                Complete registrant profile
              </a>
            </p>
          ) : searchParams?.available === "1" && searchParams.check ? (
            <form action={purchaseManagedDomainAction} className="space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <span className="font-mono font-semibold">{searchParams.check}</span> looks available.
                {searchParams.price
                  ? ` Registrar list price about ${searchParams.price}/year — this uses one domain from your plan, not a separate checkout.`
                  : " This uses one domain from your plan. There is no separate registrar checkout."}
              </p>
              <input type="hidden" name="domain" value={searchParams.check} />
              <label className="flex gap-2 text-sm">
                <input type="checkbox" name="attestation" required value="on" className="mt-1" />
                <span>I confirm the registrant profile is accurate and authorize this registration.</span>
              </label>
              <button className="rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white" disabled={atCap}>
                Register domain
              </button>
            </form>
          ) : (
            <form action={checkManagedDomainAction} className="space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                We’ll check availability, then register it under your plan domain allowance.
              </p>
              <label className="grid gap-1 text-sm font-medium">
                Domain to register
                <input
                  name="domain"
                  required
                  placeholder="youragency.com"
                  defaultValue={searchParams?.check}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <button className="rounded-xl border border-slate-300 px-4 py-2 font-semibold" disabled={atCap}>
                Check availability
              </button>
            </form>
          )}
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Canceling a registered domain later requires support — it is not the same as disconnecting a domain you
            brought.{" "}
            <a className="font-semibold underline" href="/dashboard/settings/domain-registrant">
              Manage registrant profile
            </a>
          </p>
        </section>
      </section>

      {domains.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-slate-700 dark:border-slate-700 dark:text-slate-300">
          No domains connected yet. Connect a domain you own to start setup.
        </p>
      ) : (
        domains.map((domain, index) => {
          const status = displaySubscriberDomainStatus({
            verificationStatus: domain.sesIdentity?.verificationStatus,
            dkimStatus: domain.sesIdentity?.dkimStatus,
            dnsPending: domain.dnsRecords.some((record) => record.status === "REQUIRED" || record.status === "PENDING"),
            dnsFailed: domain.dnsRecords.some((record) => record.status === "FAILED"),
            warmupStatus: domain.warmupPlan?.status,
          });
          const canRemove = canRemoveDomains && isSubscriberRemovableByoDomain(domain, workspace.id);
          const hostHint = hostHints[index];
          const showDnsInline = status.label !== "Verified";
          const dnsTable = (
            <DnsRecordsTable
              domainName={domain.domainName}
              records={domain.dnsRecords}
              hostHint={hostHint}
            />
          );
          return (
            <article
              key={domain.id}
              className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{domain.domainName}</h2>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {status.label === "Verified" ? (
                      <>
                        <strong>Verified</strong> — you can create mailboxes on this domain.
                      </>
                    ) : (
                      <>
                        <strong>{status.label}.</strong> {status.detail}
                      </>
                    )}
                  </p>
                  {domain.sesIdentity?.safeError && !domain.sesIdentity.safeError.startsWith("OPERATOR_FORCE") ? (
                    <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">{domain.sesIdentity.safeError}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-start justify-end gap-2">
                  {showDnsInline ? (
                    <form action={verifyByoDomainAction}>
                      <input type="hidden" name="domainId" value={domain.id} />
                      <button className="rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white">Verify DNS</button>
                    </form>
                  ) : (
                    <ViewDnsRecords domainName={domain.domainName}>{dnsTable}</ViewDnsRecords>
                  )}
                  {canRemove ? (
                    <RemoveByoDomainForm domainId={domain.id} domainName={domain.domainName} action={removeByoDomainAction} />
                  ) : domain.providerDomainId ? (
                    <p className="max-w-xs text-right text-xs text-slate-600 dark:text-slate-400">
                      This registered domain cannot be canceled here. Email support@quantumreach.app.
                    </p>
                  ) : null}
                </div>
              </div>
              {showDnsInline ? dnsTable : null}
            </article>
          );
        })
      )}
    </main>
  );
}
