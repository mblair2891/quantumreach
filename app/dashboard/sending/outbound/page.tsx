import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { prisma } from "@/lib/db/prisma";
import { getWorkspaceEffectiveEntitlements } from "@/lib/sending-infrastructure/operational";
import { getSendingGates } from "@/lib/sending-infrastructure/gates";
import { domainDailyLimit, sendingPackageLimits, INBOXES_PER_DOMAIN, DEFAULT_INBOX_DAILY_LIMIT } from "@/lib/outbound/config";
import { listSendingDomains } from "@/lib/outbound/service";
import { campaignCapacity } from "@/lib/outbound/campaigns";
import { isGoogleOAuthConfigured } from "@/lib/outbound/google-oauth";
import {
  addOutboundDomainAction,
  addOutboundInboxAction,
  disconnectGoogleInboxAction,
  importOutboundContactsAction,
  stubOutboundSendAction,
} from "./actions";

function googleBanner(google?: string) {
  if (google === "connected") return "Google inbox connected. Campaigns send from this mailbox when managed sending is on.";
  if (google === "disconnected") return "Google disconnected. This inbox is marked unhealthy until you reconnect.";
  if (google === "mismatch") return "The Google account email must match this inbox address on the sending domain.";
  if (google === "error") return "Could not connect Google. Try again as a workspace admin.";
  return null;
}

export default async function OutboundPage({
  searchParams,
}: {
  searchParams?: { error?: string; added?: string; sent?: string; google?: string };
}) {
  const { workspace, membership } = await requireSubscriberWorkspaceAccess();
  const isAdmin = ["WORKSPACE_OWNER", "ADMIN"].includes(String(membership.roleKey));
  const [{ effective }, domains, contacts, capacity] = await Promise.all([
    getWorkspaceEffectiveEntitlements(workspace.id),
    listSendingDomains(workspace.id),
    prisma.contact.findMany({
      where: { workspaceId: workspace.id, email: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    campaignCapacity(workspace.id),
  ]);
  const limits = sendingPackageLimits(effective);
  const inboxCount = domains.reduce((sum, domain) => sum + domain.inboxes.length, 0);
  const gated = !getSendingGates().managedSendingEnabled;
  const googleConfigured = isGoogleOAuthConfigured();
  const capacityByInbox = new Map(capacity.map((row) => [row.inboxId, row]));
  const googleNotice = googleBanner(searchParams?.google);

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-50">Cold outreach</h1>
        <p className="mt-2 max-w-3xl text-slate-700 dark:text-slate-300">
          Sending packages entitle sending domains and outreach inboxes only. Max {INBOXES_PER_DOMAIN} inboxes per
          domain. Default {DEFAULT_INBOX_DAILY_LIMIT} cold sends per inbox per UTC day. Campaigns send through a
          connected Google inbox. This path does not use SES.
        </p>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
          Package: {limits.maxSendingDomains} sending domains · {limits.maxInboxes} inboxes · {domains.length} /{" "}
          {limits.maxSendingDomains} domains used · {inboxCount} / {limits.maxInboxes} inboxes used.
        </p>
        {gated ? (
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            Real Gmail sending is off until <code>MANAGED_SENDING_ENABLED=true</code>. You can still connect Google.
            Campaigns use the stub provider in this environment and never send through Google or SES.
          </p>
        ) : (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
            Managed sending is on. Connected Google inboxes send real mail. Inboxes without a Google connection stay on
            the stub provider (Preview/dev).
          </p>
        )}
        <p className="mt-3">
          <a className="font-semibold text-sky-800 underline" href="/dashboard/sending/outbound/campaigns">
            Outreach campaigns
          </a>
        </p>
      </header>

      {searchParams?.error ? (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          {searchParams.error}
        </p>
      ) : null}
      {googleNotice ? (
        <p role="status" className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
          {googleNotice}
        </p>
      ) : null}
      {searchParams?.added ? (
        <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
          Saved {searchParams.added}.
        </p>
      ) : null}
      {searchParams?.sent ? (
        <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
          Stub sent.
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-950">Add sending domain</h2>
        <p className="mt-1 text-sm text-slate-600">Hostname only. Not your main website domain.</p>
        <form action={addOutboundDomainAction} className="mt-4 flex flex-wrap gap-3">
          <input name="hostname" required placeholder="outreach.example.com" className="rounded-xl border px-3 py-2" />
          <button className="rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white">Add domain</button>
        </form>
      </section>

      <section className="space-y-4">
        {domains.map((domain) => {
          const cap = domainDailyLimit(domain.inboxes.length, domain.dailyCapOverride);
          return (
            <article key={domain.id} className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-semibold text-slate-950">{domain.domain}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {domain.inboxes.length} / {INBOXES_PER_DOMAIN} inboxes · domain daily cap {cap}
              </p>
              <ul className="mt-3 space-y-3 text-sm text-slate-800">
                {domain.inboxes.map((inbox) => {
                  const row = capacityByInbox.get(inbox.id);
                  const googleStatus = inbox.googleConnectionStatus || "DISCONNECTED";
                  const connected = googleStatus === "CONNECTED";
                  return (
                    <li key={inbox.id} className="rounded-xl border border-slate-100 p-3">
                      <p>
                        {inbox.emailAddress} · {inbox.status} · {inbox.health}
                      </p>
                      <p className="mt-1 text-slate-600">
                        Google {googleStatus.toLowerCase()}
                        {inbox.provider === "google" ? " · provider google" : " · provider stub"} · {inbox.dailyLimit}
                        /day · {row?.usedToday ?? 0} sent today · {row?.remaining ?? inbox.dailyLimit} remaining
                        {row && !row.allowed ? ` · blocked (${row.reason})` : ""}
                      </p>
                      {inbox.lastSuccessfulSendAt ? (
                        <p className="mt-1 text-slate-600">
                          Last successful send {inbox.lastSuccessfulSendAt.toLocaleString()}
                        </p>
                      ) : (
                        <p className="mt-1 text-slate-600">No successful send yet.</p>
                      )}
                      {inbox.lastError ? <p className="mt-1 text-amber-800">{inbox.lastError}</p> : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {isAdmin && googleConfigured && connected ? (
                          <form action={disconnectGoogleInboxAction}>
                            <input type="hidden" name="inboxId" value={inbox.id} />
                            <button className="rounded-lg border px-3 py-1 text-xs font-semibold">Disconnect Google</button>
                          </form>
                        ) : null}
                        {isAdmin && googleConfigured && !connected ? (
                          <a
                            className="rounded-lg bg-sky-700 px-3 py-1 text-xs font-semibold text-white"
                            href={`/api/integrations/google/connect?inboxId=${inbox.id}`}
                          >
                            Connect Google
                          </a>
                        ) : null}
                        {isAdmin && !googleConfigured ? (
                          <p className="text-xs text-slate-600">Google OAuth is not configured in this environment.</p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
                {!domain.inboxes.length ? <li>No inboxes yet.</li> : null}
              </ul>
              <form action={addOutboundInboxAction} className="mt-4 flex flex-wrap items-end gap-3">
                <input type="hidden" name="sendingDomainId" value={domain.id} />
                <label className="text-sm">
                  Inbox
                  <input name="localPart" required placeholder="hello" className="mt-1 block rounded-xl border px-3 py-2" />
                </label>
                <button className="rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white">Add inbox</button>
              </form>
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-950">Import contacts CSV</h2>
        <p className="mt-1 text-sm text-slate-600">Columns: email, firstName, lastName</p>
        <form action={importOutboundContactsAction} className="mt-4 grid gap-3">
          <input name="listName" placeholder="List name" defaultValue="Imported contacts" className="rounded-xl border px-3 py-2" />
          <textarea name="csvText" rows={5} placeholder={"email,firstName,lastName\nprospect@example.com,Ada,Lovelace"} className="rounded-xl border px-3 py-2 font-mono text-sm" />
          <button className="w-fit rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white">Import contacts</button>
        </form>
        {contacts.length ? (
          <ul className="mt-4 space-y-1 text-sm text-slate-800">
            {contacts.map((contact) => (
              <li key={contact.id}>
                {contact.email} — {contact.firstName} {contact.lastName}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-950">Stub send</h2>
        <p className="mt-1 text-sm text-slate-600">Logs “stub sent” only if inbox, domain, and package limits allow it. Does not use Google or SES.</p>
        <form action={stubOutboundSendAction} className="mt-4 flex flex-wrap gap-3">
          <select name="inboxId" required className="rounded-xl border px-3 py-2">
            <option value="">Choose inbox</option>
            {domains.flatMap((domain) =>
              domain.inboxes.map((inbox) => (
                <option key={inbox.id} value={inbox.id}>
                  {inbox.emailAddress}
                </option>
              )),
            )}
          </select>
          <input name="toEmail" type="email" required placeholder="prospect@example.com" className="rounded-xl border px-3 py-2" />
          <button className="rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white">Stub send</button>
        </form>
      </section>
    </main>
  );
}
