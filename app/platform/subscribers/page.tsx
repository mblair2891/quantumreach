import { requireOperatorAccess } from "@/lib/admin/operator";
import { prisma } from "@/lib/db/prisma";
import { DeleteTestSubscriberForm } from "./delete-form";

export default async function SubscribersPage() {
  await requireOperatorAccess();

  const withSubs = await prisma.saasSubscriberProfile.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      userId: true,
      subscriberType: true,
      workspaceId: true,
      createdAt: true,
    },
  });
  const userIds = withSubs.map((row) => row.userId);
  const profiles = userIds.length
    ? await prisma.userProfile.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, firstName: true, lastName: true, createdAt: true, authUserId: true },
      })
    : [];
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const rows = withSubs
    .map((sub) => {
      const profile = profileById.get(sub.userId);
      if (!profile) return null;
      return { ...profile, subscriberType: sub.subscriberType, workspaceId: sub.workspaceId };
    })
    .filter(Boolean) as Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    createdAt: Date;
    authUserId: string | null;
    subscriberType: string;
    workspaceId: string | null;
  }>;

  return (
    <main className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-slate-50">Subscribers</h1>
        <p className="mt-2 max-w-3xl text-slate-300">
          Private-beta subscriber directory. Use the delete tool below to wipe test accounts so you can re-run pay-first
          acquisition cleanly. Operator allowlist emails cannot be deleted here.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-slate-50">Delete test subscriber</h2>
        <p className="mt-2 text-sm text-slate-400">
          Removes UserProfile, Better Auth credentials/sessions, owned test workspace scaffolding, and detaches orders
          (orders keep purchaserEmail for audit). Does not run live provider teardown.
        </p>
        <div className="mt-4">
          <DeleteTestSubscriberForm />
        </div>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-slate-700">
        <table className="w-full min-w-[40rem] text-left text-sm text-slate-200">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Workspace</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
                  No subscriber profiles yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-800">
                  <td className="px-4 py-3 font-mono text-xs">{row.email}</td>
                  <td className="px-4 py-3">{[row.firstName, row.lastName].filter(Boolean).join(" ") || "—"}</td>
                  <td className="px-4 py-3">{row.subscriberType}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.workspaceId ?? "—"}</td>
                  <td className="px-4 py-3">{row.createdAt.toISOString().slice(0, 10)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
