import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { prisma } from "@/lib/db/prisma";
import { getWorkspaceEffectiveEntitlements } from "@/lib/sending-infrastructure/operational";
import { domainDailyLimit, sendingPackageLimits, INBOXES_PER_DOMAIN, DEFAULT_INBOX_DAILY_LIMIT } from "@/lib/outbound/config";
import { listSendingDomains } from "@/lib/outbound/service";
import {
  addOutboundDomainAction,
  addOutboundInboxAction,
  importOutboundContactsAction,
  stubOutboundSendAction,
} from "./actions";

export default async function OutboundPage({
  searchParams,
}: {
  searchParams?: { error?: string; added?: string; sent?: string };
}) {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  const [{ effective }, domains, contacts] = await Promise.all([
    getWorkspaceEffectiveEntitlements(workspace.id),
    listSendingDomains(workspace.id),
    prisma.contact.findMany({
      where: { workspaceId: workspace.id, email: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const limits = sendingPackageLimits(effective);
  const inboxCount = domains.reduce((sum, domain) => sum + domain.inboxes.length, 0);

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-50">Cold outreach</h1>
        <p className="mt-2 max-w-3xl text-slate-700 dark:text-slate-300">
          Sending packages entitle sending domains and outreach inboxes only. Max {INBOXES_PER_DOMAIN} inboxes per
          domain. Default {DEFAULT_INBOX_DAILY_LIMIT} cold sends per inbox per UTC day. This path does not use SES.
        </p>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
          Package: {limits.maxSendingDomains} sending domains · {limits.maxInboxes} inboxes · {domains.length} /{" "}
          {limits.maxSendingDomains} domains used · {inboxCount} / {limits.maxInboxes} inboxes used.
        </p>
      </header>

      {searchParams?.error ? (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          {searchParams.error}
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
              <ul className="mt-3 space-y-1 text-sm text-slate-800">
                {domain.inboxes.map((inbox) => (
                  <li key={inbox.id}>
                    {inbox.emailAddress} · {inbox.status} · {inbox.dailyLimit}/day
                  </li>
                ))}
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
        <p className="mt-1 text-sm text-slate-600">Logs “stub sent” only if inbox, domain, and package limits allow it.</p>
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
