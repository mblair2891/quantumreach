import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { prisma } from "@/lib/db/prisma";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { flaggedSample, importRowsFromBatch } from "@/lib/revenue-os/imports";
import { commitReadyImportAction } from "../actions";

function flagLabel(flag: string) {
  return flag.replaceAll("_", " ");
}

export default async function ImportBatchPage({
  params,
  searchParams,
}: {
  params: { batchId: string };
  searchParams?: { error?: string; committed?: string };
}) {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  const batch = await prisma.contactImportBatch.findFirst({
    where: { id: params.batchId, workspaceId: workspace.id },
    include: { rows: { orderBy: { rowNumber: "asc" } } },
  });
  if (!batch) notFound();
  const rows = importRowsFromBatch(batch);
  const samples = flaggedSample(rows, 12);
  const committed = batch.status === "COMMITTED";

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        <Link className="underline" href="/dashboard/imports">
          Contact imports
        </Link>
      </p>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{batch.fileName ?? "CSV import"}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Status {batch.status.toLowerCase()}
          {batch.listName ? ` · list ${batch.listName}` : ""}. Campaigns only enroll ready contacts.
        </p>
      </header>

      {searchParams?.error ? (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          {searchParams.error}
        </p>
      ) : null}
      {searchParams?.committed ? (
        <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
          Ready contacts were imported. Flagged rows were not enrolled.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-5">
        {[
          ["Rows", batch.rowCount],
          ["Ready", batch.readyCount],
          ["Needs review", batch.needsReviewCount],
          ["Invalid", batch.rows.filter((row) => row.hygieneStatus === "INVALID").length],
          ["Merged", batch.mergedCount],
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
          <CardTitle>Import ready only</CardTitle>
          <CardDescription>
            {batch.readyCount} campaign-ready primary rows. Needs review, invalid, suppressed, and duplicate rows stay
            out of the audience. Attest that you have lawful authority to contact these people.
          </CardDescription>
        </CardHeader>
        <div className="flex flex-wrap items-center gap-3 p-6 pt-0">
          {committed ? (
            <p className="text-sm text-slate-600">This batch is already committed.</p>
          ) : (
            <form action={commitReadyImportAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="batchId" value={batch.id} />
              <label className="text-sm">
                <input type="checkbox" name="complianceAttested" required className="mr-2" />
                I have lawful authority to contact imported ready rows
              </label>
              <Button type="submit" disabled={batch.readyCount === 0}>
                Import {batch.readyCount} ready
              </Button>
            </form>
          )}
          <a className="text-sm font-medium underline" href={`/dashboard/imports/${batch.id}/rejects`}>
            Export rejects
          </a>
          {batch.readyCount === 0 ? (
            <p className="text-sm text-amber-800">No ready rows. Fix the CSV or review flagged contacts first.</p>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sample flagged rows</CardTitle>
          <CardDescription>Domain mismatch, emoji junk, invalid email, duplicates, and missing required fields.</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto p-6 pt-0">
          <table className="w-full text-left text-sm">
            <thead className="border-y border-border bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="p-3">Row</th>
                <th className="p-3">Email</th>
                <th className="p-3">Name</th>
                <th className="p-3">Company</th>
                <th className="p-3">Status</th>
                <th className="p-3">Flags</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((row) => (
                <tr key={row.rowNumber} className="border-b border-border">
                  <td className="p-3">{row.rowNumber}</td>
                  <td className="p-3 font-mono text-xs">{row.mapped.email || "—"}</td>
                  <td className="p-3">
                    {row.mapped.firstName} {row.mapped.lastName}
                  </td>
                  <td className="p-3">{row.mapped.companyRaw || row.mapped.company || "—"}</td>
                  <td className="p-3">{row.isPrimary ? row.hygieneStatus.toLowerCase() : "merged"}</td>
                  <td className="p-3 text-slate-600">{row.flags.map(flagLabel).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!samples.length ? <p className="p-3 text-sm text-slate-500">No flagged rows in this file.</p> : null}
        </div>
      </Card>
    </div>
  );
}
