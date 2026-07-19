"use client";
import { useState } from "react";
import { bootstrapCatalogAction } from "@/app/platform/catalog/actions";

export function CatalogBootstrap({ label = "Initialize Quantum Reach Catalog" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return <>{open ? <section className="max-w-xl rounded-2xl border border-amber-300 bg-amber-50 p-5 text-slate-900 shadow-sm" role="dialog" aria-labelledby="catalog-confirmation">
    <h2 id="catalog-confirmation" className="text-lg font-semibold">Initialize the default Quantum Reach product catalog?</h2>
    <p className="mt-2 text-sm text-slate-700">This creates product records and default infrastructure entitlements. No Stripe prices will be created. It is additive and safe to run again.</p>
    <form action={bootstrapCatalogAction} className="mt-4 flex gap-3"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium">Cancel</button><button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white">Initialize catalog</button></form>
  </section> : <button onClick={() => setOpen(true)} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white">{label}</button>}</>;
}
