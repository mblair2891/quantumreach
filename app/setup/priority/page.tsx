import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { catalogPrice, getDraftSession, money, readDraft, setupProductKeys } from "@/lib/customer-journey/acquisition-draft";
import { FunnelProgress } from "@/components/funnel/progress";
import { FunnelShell } from "@/components/funnel/shell";
import { choosePriority } from "./actions";

export default async function PriorityPage() {
  const session = await getDraftSession(); const draft = session ? readDraft(session.metadata) : {};
  if (!draft.coreProductId || !draft.infrastructureProductId) redirect("/setup/infrastructure");
  const products = await prisma.commerceProduct.findMany({ where: { key: { in: Object.values(setupProductKeys) }, category: "SETUP_FEE", active: true }, orderBy: { sortOrder: "asc" } });
  return <FunnelShell><main className="mx-auto max-w-5xl px-5 py-12 sm:py-16"><FunnelProgress current={3}/><p className="text-center funnel-eyebrow">Step 3 · Setup</p><h1 className="text-center funnel-title mt-3 text-4xl font-semibold sm:text-5xl">Choose setup priority.</h1><p className="mx-auto mt-4 max-w-2xl funnel-copy text-center">Priority changes queue handling only. It never bypasses safety, provider, or compliance requirements.</p><div className="mt-10 grid gap-5 md:grid-cols-3">{products.map(product => { const priority = Object.entries(setupProductKeys).find(([, key]) => key === product.key)?.[0]; if (!priority) return null; const price = catalogPrice(product); return <form action={choosePriority} key={product.id} className={`funnel-card flex flex-col p-7 ${draft.setupPriority === priority ? "border-indigo-500 ring-2 ring-indigo-100" : ""}`}><input type="hidden" name="priority" value={priority}/><h2 className="text-2xl font-semibold">{product.name}</h2><p className="mt-3 text-slate-600">{product.description ?? "Setup review and queue handling."}</p><p className="mt-6 font-semibold">{price.configured ? `${money(price.oneTimeCents || price.recurringCents)} ${product.recurring ? "recurring" : "one-time"}` : "Included or manually confirmed"}</p><button className="funnel-primary mt-auto pt-3">Choose {product.name}</button></form>})}</div><Link className="mt-8 inline-block text-sm font-semibold text-indigo-700 underline" href="/setup/infrastructure">← Edit infrastructure</Link></main></FunnelShell>;
}
