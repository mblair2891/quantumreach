import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { prisma } from "@/lib/db/prisma";
import { isSesIdentityVerified } from "@/lib/sending-infrastructure/gates";
import { addByoDomainAction, verifyByoDomainAction } from "./actions";

export default async function Page() {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  const domains = await prisma.managedDomain.findMany({
    where: { OR: [{ workspaceId: workspace.id }, { assignments: { some: { workspaceId: workspace.id, status: "ACTIVE" } } }] },
    include: { dnsRecords: true, sesIdentity: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-50">Sending domains</h1>
        <p className="mt-2 max-w-2xl text-slate-700 dark:text-slate-300">
          Add a domain you already own. Publish the DNS records at your registrar, then verify. We never mark a domain
          ready without verification evidence.
        </p>
      </header>

      <form action={addByoDomainAction} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50">
        <h2 className="text-lg font-semibold">Add your domain</h2>
        <input
          name="domain"
          required
          placeholder="example.com"
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
        />
        <button className="rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white">Add domain</button>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Need registrant details for a purchased domain?{" "}
          <a className="font-semibold underline" href="/dashboard/settings/domain-registrant">
            Manage registrant profile
          </a>
        </p>
      </form>

      {domains.length === 0 ? (
        <p className="text-slate-700 dark:text-slate-300">No sending domains yet. Add one you already own.</p>
      ) : (
        domains.map((domain) => {
          const sesOk = isSesIdentityVerified(domain.sesIdentity?.verificationStatus);
          const dkimOk = isSesIdentityVerified(domain.sesIdentity?.dkimStatus);
          const status = sesOk && dkimOk ? "Verified" : sesOk ? "Waiting on DKIM" : "Action needed from you";
          return (
            <article key={domain.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{domain.domainName}</h2>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {status}. SES {domain.sesIdentity?.verificationStatus ?? "NOT_CONFIGURED"} · DKIM{" "}
                    {domain.sesIdentity?.dkimStatus ?? "NOT_CONFIGURED"}
                  </p>
                  {domain.sesIdentity?.safeError ? (
                    <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">{domain.sesIdentity.safeError}</p>
                  ) : null}
                </div>
                <form action={verifyByoDomainAction}>
                  <input type="hidden" name="domainId" value={domain.id} />
                  <button className="rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white">Verify DNS</button>
                </form>
              </div>
              <div>
                <h3 className="font-semibold">Publish these DNS records</h3>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2 pr-3">Type</th>
                        <th className="py-2 pr-3">Name</th>
                        <th className="py-2 pr-3">Value</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {domain.dnsRecords.map((record) => (
                        <tr key={record.id} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 pr-3 font-mono">{record.type}</td>
                          <td className="py-2 pr-3 font-mono text-xs">{record.name}</td>
                          <td className="py-2 pr-3 font-mono text-xs">{record.value}</td>
                          <td className="py-2">{record.status === "VERIFIED" ? "Found" : record.status === "FAILED" ? "Not matching" : "Waiting"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </article>
          );
        })
      )}
    </main>
  );
}
