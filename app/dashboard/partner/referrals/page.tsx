import { prisma } from "@/lib/db/prisma";
import { requireUserProfile } from "@/lib/auth/rbac";

function appBaseUrl() {
  const base = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  return base || "";
}

export default async function PartnerReferralsPage() {
  const user = await requireUserProfile();
  const participant = await prisma.affiliateParticipant.findUnique({
    where: { userId: user.id },
    include: {
      memberships: {
        where: { status: { in: ["ACTIVE", "SUSPENDED"] } },
        include: { code: true },
        take: 1,
        orderBy: { startedAt: "desc" },
      },
    },
  });
  const membership = participant?.memberships[0];
  const available = membership?.status === "ACTIVE" && membership.code?.status === "ACTIVE";
  const path = available ? `/r/${membership!.code!.code}` : "";
  const absolute = available && appBaseUrl() ? `${appBaseUrl()}${path}` : path;

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-50">Your referral code</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Share your Quantum Reach referral link. Affiliate membership is included automatically with active paid subscriber access.
        </p>
      </header>
      {available ? (
        <section className="max-w-2xl space-y-4 rounded-xl border border-slate-300 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-slate-800 dark:text-slate-100">
            <strong>Membership status:</strong> {membership!.status}
          </p>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Referral code
            <input
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              readOnly
              value={membership!.code!.code}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Referral link
            <input
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              readOnly
              value={absolute}
            />
          </label>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Select and copy the link to share it. No internal account identifiers are included.
          </p>
        </section>
      ) : (
        <p
          role="status"
          className="max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          No active referral code is available. Referral access is available while your paid subscriber access and affiliate membership are active.
        </p>
      )}
    </main>
  );
}
