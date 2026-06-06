"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AnalysisReviewStatus = "NEEDS_REVIEW" | "REVIEWED" | "FINAL" | "REJECTED";
export type AnalysisStatusUpdateState = { message?: string; error?: string; savedStatus?: AnalysisReviewStatus };

const statusOptions: Array<{ value: AnalysisReviewStatus; label: string; description: string }> = [
  { value: "NEEDS_REVIEW", label: "Needs Review", description: "Returned to the review queue." },
  { value: "REVIEWED", label: "Reviewed", description: "Approved for deliverable generation." },
  { value: "FINAL", label: "Final", description: "Locked as final executive-ready analysis." },
  { value: "REJECTED", label: "Rejected", description: "Not approved for downstream use." }
];

function StatusSubmitButton({ hasChange }: { hasChange: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" className="w-full" disabled={!hasChange || pending}>{pending ? "Updating status..." : hasChange ? "Update Status" : "No status change"}</Button>;
}

export function AnalysisStatusForm({ currentStatus, action }: { currentStatus: AnalysisReviewStatus; action: (state: AnalysisStatusUpdateState, formData: FormData) => Promise<AnalysisStatusUpdateState> }) {
  const [state, formAction] = useFormState(action, { savedStatus: currentStatus });
  const savedStatus = state.savedStatus ?? currentStatus;
  const [selectedStatus, setSelectedStatus] = useState<AnalysisReviewStatus>(savedStatus);
  const hasChange = selectedStatus !== savedStatus;

  useEffect(() => {
    setSelectedStatus(savedStatus);
  }, [savedStatus]);

  const selectedLabel = statusOptions.find((option) => option.value === selectedStatus)?.label ?? selectedStatus;
  const currentLabel = statusOptions.find((option) => option.value === savedStatus)?.label ?? savedStatus;

  return (
    <CardLikeForm action={formAction}>
      <div>
        <h2 className="text-base font-semibold">Review Status</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Select the appropriate review state, then click Update Status to save the change.</p>
      </div>
      <div className="grid gap-2" role="radiogroup" aria-label="Analysis review status">
        {statusOptions.map((option) => {
          const isSelected = selectedStatus === option.value;
          const isCurrent = savedStatus === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "cursor-pointer rounded-xl border p-3 text-sm transition focus-within:ring-2 focus-within:ring-ring",
                isSelected
                  ? "border-slate-950 bg-slate-950 text-white shadow-sm dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900"
              )}
            >
              <input type="radio" name="status" value={option.value} checked={isSelected} onChange={() => setSelectedStatus(option.value)} className="sr-only" />
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="font-medium">{option.label}</span>
                  <span className={cn("mt-1 block text-xs", isSelected ? "text-slate-200 dark:text-slate-700" : "text-slate-500 dark:text-slate-400")}>{option.description}</span>
                </span>
                {isCurrent && <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", isSelected ? "border-white/40 text-white dark:border-slate-950/30 dark:text-slate-950" : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200")}>Current</span>}
              </span>
            </label>
          );
        })}
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60">
        <p><span className="font-medium">Current:</span> {currentLabel}</p>
        <p><span className="font-medium">Selected:</span> {selectedLabel}</p>
        {hasChange ? <p className="mt-1 text-amber-700 dark:text-amber-300">Unsaved status change.</p> : <p className="mt-1 text-slate-500 dark:text-slate-400">Status is up to date.</p>}
      </div>
      {state.error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{state.error}</p>}
      {state.message && !state.error && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{state.message}</p>}
      <StatusSubmitButton hasChange={hasChange} />
    </CardLikeForm>
  );
}

function CardLikeForm({ action, children }: { action: (formData: FormData) => void; children: React.ReactNode }) {
  return <form action={action} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">{children}</form>;
}
