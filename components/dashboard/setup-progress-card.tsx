import Link from "next/link";

export type SetupProgressState = {
  customerActionRequired: boolean;
  blocked: boolean;
  onboardingComplete: boolean;
  completedSteps: number;
  totalSteps: number;
};

export function SetupProgressCard({ state }: { state: SetupProgressState | null }) {
  if (!state) return null;
  if (state.onboardingComplete && !state.customerActionRequired && !state.blocked) return null;

  const needsYou = !state.onboardingComplete || state.customerActionRequired;
  const title = needsYou ? "Finish your setup" : "Setup in progress";
  const detail = state.blocked
    ? "We're resolving a sending-provider issue. You can keep using the rest of your workspace."
    : needsYou
      ? "A few details are still needed to complete your workspace."
      : "We're preparing your sending infrastructure in the background.";
  const href = state.onboardingComplete ? "/setup/status" : "/dashboard/onboarding";
  const cta = state.onboardingComplete ? "View sending setup" : "Continue setup";

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-slate-950 dark:border-sky-900 dark:bg-sky-950 dark:text-slate-50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-slate-800 dark:text-slate-200">
            {state.completedSteps} of {state.totalSteps} steps complete.
          </p>
          <p className="mt-1 text-slate-700 dark:text-slate-300">{detail}</p>
        </div>
        <Link className="rounded bg-sky-700 px-3 py-2 font-medium text-white" href={href}>
          {cta}
        </Link>
      </div>
    </section>
  );
}
