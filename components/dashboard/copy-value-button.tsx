"use client";

import { useState } from "react";

export function CopyValueButton({
  value,
  label = "Copy",
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 2000);
    }
  }

  const text = status === "copied" ? "Copied!" : status === "error" ? "Copy failed" : label;

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className={
        className ||
        "inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
      }
      aria-live="polite"
    >
      {text}
    </button>
  );
}
