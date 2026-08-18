/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { prisma } from "@/lib/db/prisma";
import { senderReadinessFromRecords } from "@/lib/sending-infrastructure/operational";
import { createSenderIdentityAction, sendWorkspaceTestEmailAction } from "./actions";
import { ENTITLEMENT_KEYS } from "@/lib/sending-infrastructure/catalog";
import { getWorkspaceEffectiveEntitlements } from "@/lib/sending-infrastructure/operational";

export default async function Page({ searchParams }: { searchParams?: { error?: string; sent?: string } }) {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  const [senders, mailboxes, domains, entitlements] = await Promise.all([
    prisma.infrastructureSenderIdentity.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" } }),
    prisma.managedMailbox.findMany({ where: { workspaceId: workspace.id } }),
    prisma.managedDomain.findMany({
      where: { OR: [{ workspaceId: workspace.id }, { assignments: { some: { workspaceId: workspace.id, status: "ACTIVE" as any } } }] },
      include: { sesIdentity: true, warmupPlan: true },
    }),
    getWorkspaceEffectiveEntitlements(workspace.id),
  ]);
  const allowed = Number(entitlements.effective[ENTITLEMENT_KEYS.SENDER_IDENTITY_ALLOWANCE] || 0);
  const readySenders = senders.filter((si) => {
    const mailbox = mailboxes.find((m) => m.id === si.managedMailboxId);
    const domain = domains.find((d) => d.id === si.managedDomainId);
    return senderReadinessFromRecords(si, mailbox, domain).ready;
  });

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Sender identities</h1>
        <p className="mt-2 text-slate-700 dark:text-slate-300">
          Plan allows {allowed} sender{allowed === 1 ? "" : "s"} · {senders.length} created. Test mail is sent from
          your workspace address, not noreply@quantumreach.app.
        </p>
      </header>
      {searchParams?.error ? (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          {searchParams.error}
        </p>
      ) : null}
      {searchParams?.sent ? (
        <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
          Test email sent.
        </p>
      ) : null}
      <form action={createSenderIdentityAction} className="space-y-3 rounded-2xl border p-5">
        <h2 className="font-semibold">Create sender</h2>
        {mailboxes.length === 0 ? (
          <p className="text-sm">Create a mailbox on a verified domain first.</p>
        ) : (
          <>
            <select name="mailboxId" className="rounded-xl border px-3 py-2">
              {mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.emailAddress}
                </option>
              ))}
            </select>
            <input name="displayName" placeholder="Display name" className="rounded-xl border px-3 py-2" />
            <button className="rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white">Create sender identity</button>
          </>
        )}
      </form>
      {readySenders[0] ? (
        <form action={sendWorkspaceTestEmailAction} className="space-y-3 rounded-2xl border p-5">
          <h2 className="font-semibold">Send a test email</h2>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Only ready senders can send. If SES is still in sandbox, the recipient must be verified in AWS.
          </p>
          <select name="senderId" className="rounded-xl border px-3 py-2">
            {readySenders.map((si) => (
              <option key={si.id} value={si.id}>
                {si.fromAddress}
              </option>
            ))}
          </select>
          <input name="to" type="email" required placeholder="you@example.com" className="rounded-xl border px-3 py-2" />
          <button className="rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white">Send test</button>
        </form>
      ) : (
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Test send is available after a sender is ready (verified domain, mailbox, and warm-up started).
        </p>
      )}
      {senders.length === 0 ? (
        <p>No sender identities have been created yet.</p>
      ) : (
        senders.map((si) => {
          const mailbox = mailboxes.find((m) => m.id === si.managedMailboxId);
          const domain = domains.find((d) => d.id === si.managedDomainId);
          const r = senderReadinessFromRecords(si, mailbox, domain);
          return (
            <article key={si.id} className="rounded-xl border p-5">
              <h2 className="text-xl font-semibold">{si.fromAddress}</h2>
              <p className="mt-1 text-sm">
                Mailbox: {mailbox?.emailAddress ?? "—"} · domain: {domain?.domainName ?? "—"} · SES: {si.sesIdentityState} ·
                DKIM: {si.dkimState} · ramp: {domain?.warmupPlan?.status ?? "NOT_STARTED"} · ready: {String(r.ready)}
              </p>
              <p className="text-sm">Blocking reasons: {r.blockingReasons.join(", ") || "None"}</p>
            </article>
          );
        })
      )}
    </main>
  );
}
