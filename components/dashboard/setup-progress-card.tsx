import Link from "next/link";

export type SetupProgressState = {
  requiredSetupComplete: boolean;
  completedSteps: number;
  totalSteps: number;
};

export function SetupProgressCard({ state }: { state: SetupProgressState | null }) {
  if (!state || state.requiredSetupComplete) return null;

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-slate-950 dark:border-sky-900 dark:bg-sky-950 dark:text-slate-50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Finish your setup</h2>
          <p className="mt-1 text-slate-800 dark:text-slate-200">
            {state.completedSteps} of {state.totalSteps} steps complete.
          </p>
          <p className="mt-1 text-slate-700 dark:text-slate-300">
            A few details are still needed to complete your workspace.
          </p>
        </div>
        <Link className="rounded bg-sky-700 px-3 py-2 font-medium text-white" href="/dashboard/onboarding">
          Continue setup
        </Link>
      </div>
    </section>
  );
}
