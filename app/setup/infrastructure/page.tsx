import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { catalogPrice, getDraftSession, money, readDraft } from "@/lib/customer-journey/acquisition-draft";
import { chooseInfrastructure } from "./actions";
import { FunnelProgress } from "@/components/funnel/progress";
import { FunnelShell } from "@/components/funnel/shell";

function details(metadata: unknown) { return typeof metadata === "object" && metadata && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {}; }
export default async function Infrastructure() {
  const session = await getDraftSession(); const draft = session ? readDraft(session.metadata) : {};
  if (!draft.coreProductId) redirect("/start");
  const products = await prisma.commerceProduct.findMany({ where: { category: "SENDING_PACKAGE", active: true }, orderBy: { sortOrder: "asc" } });
  return <FunnelShell><main className="mx-auto max-w-6xl px-5 py-12 sm:py-16"><FunnelProgress current={2}/><p className="text-center funnel-eyebrow">Step 2 · Infrastructure</p><h1 className="text-center funnel-title mt-3 text-4xl font-semibold sm:text-5xl">Choose your sending foundation.</h1><p className="mx-auto mt-4 max-w-2xl funnel-copy text-center">This selection records your intended managed package. Nothing is purchased or provisioned before authorized clearance.</p><div className="mt-10 grid gap-5 md:grid-cols-3">{products.map(product => { const m = details(product.metadata), price = catalogPrice(product); return <form key={product.id} action={chooseInfrastructure} className={`flex flex-col funnel-card p-6 ${draft.infrastructureProductId === product.id ? "border-indigo-500 ring-2 ring-indigo-100" : ""}`}><input type="hidden" name="productId" value={product.id}/><h2 className="text-2xl font-semibold">{product.name}</h2><p className="mt-3 text-sm text-slate-600">{product.description ?? "Managed infrastructure for responsible outreach."}</p><ul className="mt-5 space-y-2 text-sm text-slate-700"><li>✓ {String(m.domains ?? "Managed domain planning")}</li><li>✓ {String(m.mailboxes ?? "Mailbox planning")}</li><li>✓ {String(m.monthlySendAllowance ?? "Sending allowance configured after approval")}</li></ul><div className="mt-auto pt-6"><p className="font-semibold">{price.configured ? `${money(price.recurringCents)} recurring` : "Pricing confirmed from catalog configuration"}</p><p className="text-sm text-slate-500">{price.oneTimeCents ? `${money(price.oneTimeCents)} one-time` : "No payment collected now"}</p><button className="funnel-primary mt-5 w-full">Choose {product.name}</button></div></form>})}</div><Link className="mt-8 inline-block text-sm font-semibold text-indigo-700 underline" href="/start">← Edit software package</Link></main></FunnelShell>;
}
