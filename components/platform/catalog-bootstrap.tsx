"use client";
import { useState } from "react";
import { bootstrapCatalogAction } from "@/app/platform/catalog/actions";

type CatalogBootstrapProps = {
  label?: string;
  mode?: "initialize" | "sync";
};

export function CatalogBootstrap({
  label = "Initialize Quantum Reach Catalog",
  mode = "initialize",
}: CatalogBootstrapProps) {
  const [open, setOpen] = useState(false);
  const copy =
    mode === "sync"
      ? {
          title: "Sync the default Quantum Reach product catalog?",
          description:
            "This adds missing default products and refreshes safe catalog defaults. Existing Stripe mappings and operator-entered metadata are preserved. No Stripe prices will be created.",
          submit: "Sync catalog",
        }
      : {
          title: "Initialize the default Quantum Reach product catalog?",
          description:
            "This creates product records and default infrastructure entitlements. No Stripe prices will be created. It is additive and safe to run again.",
          submit: "Initialize catalog",
        };
  return (
    <>
      {open ? (
        <section
          className="max-w-xl rounded-2xl border border-amber-300 bg-amber-50 p-5 text-slate-900 shadow-sm"
          role="dialog"
          aria-labelledby="catalog-confirmation"
        >
          <h2 id="catalog-confirmation" className="text-lg font-semibold">
            {copy.title}
          </h2>
          <p className="mt-2 text-sm text-slate-700">{copy.description}</p>
          <form action={bootstrapCatalogAction} className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white">
              {copy.submit}
            </button>
          </form>
        </section>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white"
        >
          {label}
        </button>
      )}
    </>
  );
}
