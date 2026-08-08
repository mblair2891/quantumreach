"use client";

import { useState } from "react";
import { signOut, useSession } from "@/lib/auth/client";

export function AccountMenu({ email }: { email?: string | null }) {
  const { data } = useSession();
  const [pending, setPending] = useState(false);
  const display = email ?? data?.user?.email ?? "Account";

  async function handleSignOut() {
    setPending(true);
    try {
      await signOut();
    } catch {
      // Fall through to hard navigation that clears cookies server-side.
    }
    // Prefer server route so session cookies are cleared even if client signOut is partial.
    window.location.href = "/sign-out?next=/start";
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden max-w-[14rem] truncate text-sm text-slate-700 dark:text-slate-200 sm:inline" title={display}>
        {display}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => void handleSignOut()}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
