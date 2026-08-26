import Link from "next/link";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { prisma } from "@/lib/db/prisma";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { previewImportAction } from "./actions";

export default async function ImportsPage({ searchParams }: { searchParams?: { error?: string } }) {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  const batches = await prisma.contactImportBatch.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const contactCounts = await prisma.contact.groupBy({
    by: ["hygieneStatus"],
    where: { workspaceId: workspace.id },
    _count: { _all: true },
  });
  const tally = Object.fromEntries(contactCounts.map((row) => [row.hygieneStatus, row._count._all]));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-slate-500">Outreach</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Contact imports</h1>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
          Hygiene runs before contacts become campaign-eligible. Ready rows can be imported; flagged rows stay out of
          send until they are reviewed.
        </p>
      </header>

      {searchParams?.error ? (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          {searchParams.error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Ready", tally.READY ?? 0],
          ["Needs review", tally.NEEDS_REVIEW ?? 0],
          ["Invalid", tally.INVALID ?? 0],
          ["Suppressed", tally.SUPPRESSED ?? 0],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-3xl">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload CSV</CardTitle>
          <CardDescription>
            Columns: email, firstName, lastName, company, companyDomain. Preview classifies ready, needs review, invalid,
            and suppressed rows before anything is enrolled.
          </CardDescription>
        </CardHeader>
        <form action={previewImportAction} className="grid gap-3 p-6 pt-0">
          <Input name="listName" placeholder="Optional outbound list name" />
          <Input name="csv" type="file" accept=".csv,text/csv" />
          <Textarea name="csvText" rows={6} placeholder={"email,firstName,lastName,company,companyDomain\nAda@Example.com, ada, lovelace, Acme 🚀, acme.com"} />
          <Button type="submit">Preview hygiene</Button>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent batches</CardTitle>
          <CardDescription>Open a preview to import ready rows only or export rejects.</CardDescription>
        </CardHeader>
        <ul className="space-y-2 p-6 pt-0 text-sm">
          {batches.map((batch) => (
            <li key={batch.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
              <Link className="font-medium underline" href={`/dashboard/imports/${batch.id}`}>
                {batch.fileName ?? "CSV import"} · {batch.status.toLowerCase()}
              </Link>
              <span className="text-slate-600 dark:text-slate-300">
                {batch.readyCount} ready · {batch.needsReviewCount} review · {batch.invalidCount} not ready · {batch.mergedCount} merged
              </span>
            </li>
          ))}
          {!batches.length ? <li className="text-slate-500">No import batches yet.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
