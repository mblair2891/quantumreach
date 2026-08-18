"use client";

import { useRef, type ReactNode } from "react";

export function ViewDnsRecords({
  domainName,
  children,
}: {
  domainName: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
      >
        View DNS records
      </button>
      <dialog
        ref={dialog}
        className="w-[min(56rem,calc(100vw-2rem))] max-h-[85vh] overflow-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 shadow-xl backdrop:bg-slate-950/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
        aria-label={`DNS records for ${domainName}`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{domainName} DNS records</h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold"
          >
            Close
          </button>
        </div>
        {children}
      </dialog>
    </>
  );
}
