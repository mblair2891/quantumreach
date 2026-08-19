import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { prisma } from "@/lib/db/prisma";
import { campaignCapacity } from "@/lib/outbound/campaigns";
import { pauseCampaignAction, processCampaignAction, startCampaignAction } from "../actions";

export default async function OutreachCampaignDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { error?: string; ran?: string };
}) {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  const campaign = await prisma.outboundCampaign.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
    include: { list: true, jobs: { orderBy: { createdAt: "asc" }, take: 50 } },
  });
  if (!campaign) notFound();
  const [counts, capacity] = await Promise.all([
    prisma.outboundCampaignJob.groupBy({
      by: ["status"],
      where: { campaignId: campaign.id },
      _count: { _all: true },
    }),
    campaignCapacity(workspace.id),
  ]);
  const tally = Object.fromEntries(counts.map((row) => [row.status, row._count._all]));

  return (
    <main className="space-y-6">
      <p className="text-sm text-slate-600">
        <Link className="underline" href="/dashboard/sending/outbound/campaigns">
          Outreach campaigns
        </Link>
      </p>
      <header>
        <h1 className="text-3xl font-semibold text-slate-950">{campaign.name}</h1>
        <p className="mt-2 text-slate-700">
          Status <strong>{campaign.status}</strong>
          {campaign.pauseReason ? ` · ${campaign.pauseReason}` : ""} · list {campaign.list.name}
        </p>
      </header>

      {searchParams?.error ? (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          {searchParams.error}
        </p>
      ) : null}
      {searchParams?.ran ? (
        <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
          Campaign worker ran a batch.
        </p>
      ) : null}

      <section className="flex flex-wrap gap-3">
        {campaign.status === "draft" || campaign.status === "paused" ? (
          <form action={startCampaignAction}>
            <input type="hidden" name="campaignId" value={campaign.id} />
            <button className="rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white">Start campaign</button>
          </form>
        ) : null}
        {campaign.status === "running" ? (
          <>
            <form action={processCampaignAction}>
              <input type="hidden" name="campaignId" value={campaign.id} />
              <button className="rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white">Process batch</button>
            </form>
            <form action={pauseCampaignAction}>
              <input type="hidden" name="campaignId" value={campaign.id} />
              <button className="rounded-xl border px-4 py-2 font-semibold">Pause</button>
            </form>
          </>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-950">Queue</h2>
        <p className="mt-2 text-sm text-slate-700">
          queued {tally.queued ?? 0} · sent {tally.sent ?? 0} · skipped {tally.skipped ?? 0} · retry {tally.retry ?? 0}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">
          <strong>{campaign.subject}</strong>
          {"\n"}
          {campaign.body}
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-950">Inbox capacity today</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-800">
          {capacity.map((row) => (
            <li key={row.inboxId}>
              {row.emailAddress} · {row.usedToday} sent · {row.remaining} inbox remaining · {row.domainRemaining} on{" "}
              {row.domain}
              {row.allowed ? "" : ` · blocked (${row.reason})`}
            </li>
          ))}
          {!capacity.length ? <li>No outreach inboxes yet.</li> : null}
        </ul>
      </section>
    </main>
  );
}
