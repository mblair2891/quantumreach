import Link from "next/link";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { prisma } from "@/lib/db/prisma";
import { getSendingGates } from "@/lib/sending-infrastructure/gates";
import { createCampaignAction } from "./actions";

export default async function OutreachCampaignsPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  const [campaigns, lists] = await Promise.all([
    prisma.outboundCampaign.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, include: { list: true } }),
    prisma.outboundList.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
      include: { members: { include: { contact: { select: { hygieneStatus: true, email: true, status: true } } } } },
    }),
  ]);
  const listReady = (list: (typeof lists)[number]) =>
    list.members.filter((member) => member.contact.status !== "ARCHIVED" && (member.contact.hygieneStatus ?? "READY") === "READY" && member.contact.email).length;
  const gated = !getSendingGates().managedSendingEnabled;

  return (
    <main className="space-y-6">
      <header>
        <p className="text-sm text-slate-600">
          <Link className="underline" href="/dashboard/sending/outbound">
            Cold outreach
          </Link>
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Outreach campaigns</h1>
        <p className="mt-2 max-w-3xl text-slate-700">
          One-step campaigns rotate across healthy inboxes and stop when daily inbox or domain caps are hit. Campaign
          mail never uses platform SES.
        </p>
        {gated ? (
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            Campaign sending is off until <code>MANAGED_SENDING_ENABLED=true</code>. You can still draft campaigns.
            Real Gmail send stays disabled; the worker will not call Google.
          </p>
        ) : null}
      </header>

      {searchParams?.error ? (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          {searchParams.error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-950">Create campaign</h2>
        <form action={createCampaignAction} className="mt-4 grid gap-3">
          <input name="name" required placeholder="April outreach" className="rounded-xl border px-3 py-2" />
          <select name="listId" required className="rounded-xl border px-3 py-2">
            <option value="">Select imported list</option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name} ({listReady(list)} ready / {list.members.length})
              </option>
            ))}
          </select>
          <input name="fromName" placeholder="From name (optional)" className="rounded-xl border px-3 py-2" />
          <input name="subject" required placeholder="Subject — Hello {{FirstName}}" className="rounded-xl border px-3 py-2" />
          <textarea
            name="body"
            required
            rows={6}
            placeholder={"Hi {{FirstName}},\n\n…\n\n{{unsubscribe_url}}"}
            className="rounded-xl border px-3 py-2"
          />
          <p className="text-sm text-slate-600">
            Body must include <code>{"{{unsubscribe_url}}"}</code>. Set your physical mailing address in{" "}
            <Link className="underline" href="/dashboard/settings">
              Settings
            </Link>{" "}
            before starting. The worker appends the legal footer on send.
          </p>
          <button className="w-fit rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white">Save draft</button>
        </form>
        {!lists.length ? (
          <p className="mt-3 text-sm text-slate-600">
            Import a CSV list on{" "}
            <Link className="underline" href="/dashboard/imports">
              Contact imports
            </Link>{" "}
            and keep only ready rows. Lists with zero ready contacts cannot start.
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        {campaigns.map((campaign) => (
          <article key={campaign.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <Link className="font-semibold text-slate-950 underline" href={`/dashboard/sending/outbound/campaigns/${campaign.id}`}>
              {campaign.name}
            </Link>
            <p className="mt-1 text-sm text-slate-600">
              {campaign.status} · list {campaign.list.name}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
