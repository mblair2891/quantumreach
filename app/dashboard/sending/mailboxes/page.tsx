/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCapacityVisibility } from "@/lib/sending-infrastructure/send-service";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { prisma } from "@/lib/db/prisma";
import { createMailboxAction, requestWarmupAction } from "./actions";
import { isSesIdentityVerified } from "@/lib/sending-infrastructure/gates";
import { getWorkspaceEffectiveEntitlements } from "@/lib/sending-infrastructure/operational";
import { ENTITLEMENT_KEYS } from "@/lib/sending-infrastructure/catalog";

const pct = (v: any) => `${(Number(v ?? 0) * 100).toFixed(2)}%`;

export default async function Page() {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  const [mailboxes, domains, entitlements, capacity] = await Promise.all([
    prisma.managedMailbox.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" } }),
    prisma.managedDomain.findMany({
      where: { OR: [{ workspaceId: workspace.id }, { assignments: { some: { workspaceId: workspace.id, status: "ACTIVE" as any } } }] },
      include: { sesIdentity: true },
    }),
    getWorkspaceEffectiveEntitlements(workspace.id),
    getCapacityVisibility(workspace.id),
  ]);
  const profiles = await prisma.mailboxWarmupProfile.findMany({ where: { workspaceId: workspace.id }, orderBy: { updatedAt: "desc" } });
  const snapshots = await prisma.mailboxHealthSnapshot.findMany({ where: { workspaceId: workspace.id }, orderBy: { windowEnd: "desc" } });
  const decisions = await prisma.warmupDecision.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { evaluationDate: "desc" },
    take: 50,
  });
  const allowed = Number(entitlements.effective[ENTITLEMENT_KEYS.MAILBOX_ALLOWANCE] || 0);
  const verifiedDomains = domains.filter(
    (domain) =>
      isSesIdentityVerified(domain.sesIdentity?.verificationStatus) &&
      isSesIdentityVerified(domain.sesIdentity?.dkimStatus),
  );

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Mailboxes</h1>
        <p className="mt-2 text-slate-700 dark:text-slate-300">
          Create a mailbox on a verified sending domain. Plan allows {allowed} mailbox{allowed === 1 ? "" : "es"} ·{" "}
          {mailboxes.length} connected.
        </p>
      </header>
      <form action={createMailboxAction} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Create mailbox</h2>
        {verifiedDomains.length === 0 ? (
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Verify a sending domain first, then you can create a mailbox.{" "}
            <a className="font-semibold underline" href="/dashboard/sending/domains">
              Sending domains
            </a>
          </p>
        ) : (
          <>
            <label className="grid gap-1 text-sm font-medium">
              Verified domain
              <select name="domainId" className="rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-950">
                {verifiedDomains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.domainName}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Local part
              <input name="localPart" placeholder="hello" required className="rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-950" />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Display name
              <input name="displayName" placeholder="Display name" className="rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-950" />
            </label>
            <button className="rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white">Create mailbox</button>
          </>
        )}
      </form>
      {mailboxes.map((m) => {
        const p = profiles.find((x) => x.managedMailboxId === m.id);
        const s = snapshots.find((x) => x.managedMailboxId === m.id);
        const history = decisions.filter((x) => x.managedMailboxId === m.id).slice(0, 5);
        const mailboxRows = capacity.rows.filter((r: any) => r.managedMailboxId === m.id && !r.isSimulated);
        const domainRows = capacity.rows.filter((r: any) => r.managedDomainId === m.managedDomainId && !r.isSimulated);
        const used = mailboxRows.filter((r: any) => r.status !== "RELEASED").length;
        const awaitingProvider = m.provisioningStatus === "PENDING_PROVIDER_CONFIGURATION" || m.provider === "DISABLED";
        return (
          <article className="rounded-xl border border-slate-200 p-5 dark:border-slate-800" key={m.id}>
            <div className="flex justify-between gap-3">
              <h2 className="text-xl font-semibold">{m.emailAddress}</h2>
              <strong>{p?.lifecycleState ?? m.provisioningStatus}</strong>
            </div>
            {awaitingProvider ? (
              <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
                Awaiting hosted mailbox provision. You can still send from this address over SES when the domain is
                verified. An operator can finish inbox hosting later.
              </p>
            ) : null}
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <p>Daily limit: {p?.currentDailyLimit ?? 0}</p>
              <p>Used today: {used}</p>
              <p>Reserved: {mailboxRows.filter((r: any) => r.status === "RESERVED").length}</p>
              <p>Committed: {mailboxRows.filter((r: any) => r.status === "COMMITTED").length}</p>
              <p>Released: {mailboxRows.filter((r: any) => r.status === "RELEASED").length}</p>
              <p>Mailbox remaining: {Math.max(0, capacity.mailboxLimit - used)}</p>
              <p>Domain remaining: {Math.max(0, capacity.domainLimit - domainRows.filter((r: any) => r.status !== "RELEASED").length)}</p>
              <p>Monthly remaining: {Math.max(0, capacity.monthlyLimit - capacity.live.monthlyCommitted)}</p>
              <p>Delivered sample: {p?.deliveredSample ?? 0}</p>
              <p>Delivery: {pct(s?.deliveryRate)}</p>
              <p>Hard bounce: {pct(s?.bounceRate)}</p>
              <p>Complaint: {pct(s?.complaintRate)}</p>
              <p>Health score: {s?.score ?? "Pending"}</p>
              <p>Healthy days: {p?.consecutiveHealthyDays ?? 0}</p>
              <p>Next evaluation: {p?.nextEvaluationAt?.toLocaleString() ?? "Not scheduled"}</p>
              <p>Provider: {m.provider}</p>
              <p>DNS/domain: {domains.find((d) => d.id === m.managedDomainId)?.lifecycleStatus ?? "Pending"}</p>
              <p>Live send: {p?.lifecycleState === "LIVE_READY" ? "Eligible" : "Warming or blocked"}</p>
            </div>
            {s && (
              <details className="mt-3">
                <summary>Score components</summary>
                <pre className="overflow-auto text-xs">{JSON.stringify(s.components, null, 2)}</pre>
              </details>
            )}
            <div className="mt-4 flex gap-2">
              {["PAUSE", "OPERATOR_REVIEW", "MAILBOX_REPLACEMENT"].map((a) => (
                <form action={requestWarmupAction} key={a}>
                  <input type="hidden" name="profileId" value={p?.id} />
                  <input type="hidden" name="action" value={a} />
                  <button disabled={!p} className="rounded border px-3 py-1">
                    {a.replaceAll("_", " ")}
                  </button>
                </form>
              ))}
            </div>
            {history.length > 0 && (
              <details className="mt-3">
                <summary>Decision history</summary>
                {history.map((d) => (
                  <p key={d.id}>
                    {d.evaluationDate.toLocaleDateString()}: {d.action} · score {d.score}
                  </p>
                ))}
              </details>
            )}
          </article>
        );
      })}
    </main>
  );
}
