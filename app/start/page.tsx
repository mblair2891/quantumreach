import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { saveDraftSelection, catalogPrice, money } from "@/lib/customer-journey/acquisition-draft";
import { AcquisitionCapture } from "./acquisition";
import { FunnelShell } from "@/components/funnel/shell";
import { FunnelProgress } from "@/components/funnel/progress";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

async function selectCore(formData: FormData) {
  "use server";
  const id = String(formData.get("productId") ?? "");
  const product = await prisma.commerceProduct.findFirst({ where: { id, category: "SOFTWARE_CORE", active: true } });
  if (!product) throw new Error("That subscriber package is no longer available.");
  await saveDraftSelection({ coreProductId: product.id, returnRoute: "/join" });
  redirect("/setup/infrastructure");
}

function metadata(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export default async function StartPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const { userId: clerkUserId } = await auth();
  const existing = clerkUserId ? await prisma.userProfile.findUnique({ where: { clerkUserId }, select: { id: true } }) : null;
  const activeSubscription = existing ? await prisma.saasSubscription.findFirst({ where: { userId: existing.id, status: { in: ["ACTIVE", "TRIALING"] }, workspaceId: { not: null } } }) : null;
  const products = await prisma.commerceProduct.findMany({ where: { category: "SOFTWARE_CORE", active: true }, include: { entitlements: true }, orderBy: { sortOrder: "asc" } });
  return <FunnelShell><AcquisitionCapture params={searchParams}/><main className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16"><FunnelProgress current={1}/>{activeSubscription && <p className="mb-7 rounded-xl bg-indigo-50 p-4 text-center text-indigo-900">This account already has an active workspace. <a className="font-semibold underline" href="/dashboard">Open your dashboard</a>; package browsing will not create a second subscription.</p>}<div className="text-center"><p className="funnel-eyebrow">Step 1 · Subscriber package</p><h1 className="funnel-title mt-3 text-4xl font-semibold sm:text-5xl">Choose your Quantum Reach platform.</h1><p className="funnel-copy mx-auto mt-4 max-w-2xl">Review the software package before creating an account. Managed sending infrastructure and setup speed come next.</p></div>{products.length ? <div className="mt-10 grid gap-6">{products.map((product, index) => { const details = metadata(product.metadata); const price = catalogPrice(product); return <form action={selectCore} key={product.id} className="funnel-card grid gap-7 p-7 sm:p-9 md:grid-cols-[1fr_auto]"><input type="hidden" name="productId" value={product.id}/><div>{index === 0 && <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Recommended</p>}<h2 className="mt-2 text-3xl font-semibold">{product.name}</h2><p className="mt-3 text-slate-600">{product.description ?? "The core operating platform for subscriber businesses."}</p><p className="mt-5 text-sm font-semibold">For: {String(details.whoItsFor ?? "operators building and running a modern client-growth business")}</p><ul className="mt-5 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">{product.entitlements.slice(0, 6).map(item => <li key={item.id}>✓ {item.entitlementKey.replaceAll("_", " ")}</li>)}</ul><p className="mt-5 text-sm text-slate-600">Infrastructure is selected separately on the next step and may remain safely deferred during Preview.</p></div><div className="flex min-w-56 flex-col justify-between rounded-2xl bg-slate-50 p-5"><div><p className="text-sm text-slate-500">Recurring software</p><p className="mt-1 text-2xl font-semibold">{price.configured ? money(price.recurringCents) : "Manual quote"}</p><p className="text-sm text-slate-500">per {product.billingInterval.toLowerCase()}</p><p className="mt-4 text-sm text-slate-500">One-time setup</p><p className="font-semibold">{price.configured ? money(price.oneTimeCents) : "Confirmed before clearance"}</p></div><button disabled={Boolean(activeSubscription)} className="funnel-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50">{activeSubscription ? "Already subscribed" : `Choose ${product.name}`}</button></div></form>})}</div> : <p role="alert" className="mt-10 rounded-xl bg-amber-50 p-5 text-amber-900">No active subscriber package is currently available. Please contact support.</p>}<p className="mt-6 text-center text-sm text-slate-500">No order, payment, or infrastructure purchase is created at this step.</p></main></FunnelShell>;
}
