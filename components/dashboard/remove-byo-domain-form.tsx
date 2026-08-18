"use client";

import { useState } from "react";

export function RemoveByoDomainForm({
  domainId,
  domainName,
  action,
}: {
  domainId: string;
  domainName: string;
  action: (form: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase().replace(/\.$/, "") === domainName.trim().toLowerCase().replace(/\.$/, "");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
      >
        Remove domain
      </button>
    );
  }

  return (
    <form action={action} className="max-w-md space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <input type="hidden" name="domainId" value={domainId} />
      <p>
        This disconnects the domain from Quantum Reach. It does not delete the domain at your registrar.
      </p>
      <p>
        Removing this domain also removes mailboxes and senders created for it. If mail is still queued or
        sending, removal is blocked.
      </p>
      <label className="grid gap-1 font-medium">
        Type {domainName} to confirm
        <input
          name="confirmName"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-mono text-sm text-slate-950"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!matches}
          className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          Remove domain
        </button>
      </div>
    </form>
  );
}
