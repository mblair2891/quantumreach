"use client";

import { useMemo, useState } from "react";

export function CreateMailboxForm({
  action,
  domains,
  atCap,
}: {
  action: (form: FormData) => Promise<void>;
  domains: Array<{ id: string; domainName: string }>;
  atCap: boolean;
}) {
  const [domainId, setDomainId] = useState(domains[0]?.id ?? "");
  const [localPart, setLocalPart] = useState("");
  const selected = domains.find((domain) => domain.id === domainId) ?? domains[0];
  const preview = useMemo(() => {
    const local = localPart.trim().toLowerCase() || "hello";
    return selected ? `${local}@${selected.domainName}` : local;
  }, [localPart, selected]);

  return (
    <form action={action} className="space-y-4">
      <label className="grid gap-1 text-sm font-medium">
        Domain
        <select
          name="domainId"
          value={domainId}
          onChange={(event) => setDomainId(event.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
        >
          {domains.map((domain) => (
            <option key={domain.id} value={domain.id}>
              {domain.domainName}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Local part
        <input
          name="localPart"
          required
          value={localPart}
          onChange={(event) => setLocalPart(event.target.value)}
          placeholder="hello"
          autoComplete="off"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
        />
        <span className="font-normal text-slate-600 dark:text-slate-400">
          Full address: <span className="font-mono text-slate-900 dark:text-slate-100">{preview}</span>
        </span>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Display name <span className="font-normal text-slate-600 dark:text-slate-400">(optional)</span>
        <input
          name="displayName"
          placeholder="Alex at your agency"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
        />
        <span className="font-normal text-slate-600 dark:text-slate-400">
          Shown as the From name. You can leave this blank.
        </span>
      </label>
      {atCap ? (
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Your plan is at its mailbox limit. Upgrade or remove a mailbox to create another.
        </p>
      ) : null}
      <button
        className="rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
        disabled={atCap || domains.length === 0}
      >
        Create mailbox
      </button>
    </form>
  );
}
