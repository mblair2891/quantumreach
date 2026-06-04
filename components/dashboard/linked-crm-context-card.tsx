import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { summarizeCrmContext } from "@/lib/crm/context-summary";
import { cn } from "@/lib/utils";

function StatusBadge({ value }: { value: string }) {
  return <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">{value}</span>;
}

export function LinkedCrmContextCard({ relatedType, crmContext }: { relatedType?: string | null; crmContext: unknown }) {
  const summary = summarizeCrmContext(relatedType, crmContext);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Linked CRM context</CardTitle>
        <CardDescription>Record type: {summary.recordType}</CardDescription>
      </CardHeader>
      <dl className="divide-y divide-border p-6 pt-0 text-sm">
        {summary.fields.map((field) => (
          <div key={field.label} className="grid gap-1 py-3 sm:grid-cols-[8rem_1fr] sm:items-center">
            <dt className="font-medium text-muted-foreground">{field.label}</dt>
            <dd className={cn("text-foreground", field.value === "—" || field.value === "Not linked" ? "text-muted-foreground" : null)}>
              {field.tone === "status" ? <StatusBadge value={field.value} /> : field.href && field.value !== "Not linked" ? <Link href={field.href} className="font-medium text-slate-900 underline-offset-4 hover:underline dark:text-slate-100">{field.value}</Link> : field.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
