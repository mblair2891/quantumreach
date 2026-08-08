import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PlatformPageTemplate({
  title,
  description,
  items = [],
  footerNote,
}: {
  title: string;
  description: string;
  items?: string[];
  footerNote?: string;
}) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-slate-300">Platform administration</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-2 max-w-3xl text-slate-200">{description}</p>
      </header>
      <section className="grid gap-4 md:grid-cols-3">
        {items.map((i) => (
          <Card key={i} className="border-slate-700 bg-slate-900 text-slate-50">
            <CardHeader>
              <CardTitle className="text-slate-50">{i}</CardTitle>
              <CardDescription className="text-slate-300">
                Safe aggregate view; no secrets or tenant-private records exposed.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-slate-100">—</CardContent>
          </Card>
        ))}
      </section>
      {footerNote ? (
        <p className="rounded-xl border border-amber-700/70 bg-amber-950/50 p-4 text-sm text-amber-50">
          {footerNote}
        </p>
      ) : null}
    </div>
  );
}
