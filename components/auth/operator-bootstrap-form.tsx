"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  bootstrapOperatorAction,
  type BootstrapOperatorActionState,
} from "@/app/setup/operator/actions";

const fieldClassName =
  "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-950 [color-scheme:light] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:border-slate-300 dark:bg-white dark:text-slate-950 dark:placeholder:text-slate-500";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
    >
      {pending ? "Creating operator…" : label}
    </button>
  );
}

export function OperatorBootstrapForm({
  requiresBootstrapSecret,
}: {
  requiresBootstrapSecret: boolean;
}) {
  const [state, formAction] = useFormState(
    bootstrapOperatorAction,
    undefined as BootstrapOperatorActionState | undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}

      <label className="block text-sm font-medium text-slate-700">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="you@company.com"
          className={fieldClassName}
        />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Username
        <input
          name="username"
          required
          pattern="[a-zA-Z0-9_]{3,32}"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="operator_handle"
          className={fieldClassName}
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">
          3–32 characters: letters, numbers, underscores. Used for username sign-in.
        </span>
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className={fieldClassName}
        />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Confirm password
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Re-enter password"
          className={fieldClassName}
        />
      </label>

      {requiresBootstrapSecret ? (
        <label className="block text-sm font-medium text-slate-700">
          Bootstrap secret
          <input
            name="bootstrapSecret"
            type="password"
            required
            autoComplete="off"
            placeholder="BOOTSTRAP_SECRET from environment"
            className={fieldClassName}
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Required because an operator account already exists.
          </span>
        </label>
      ) : null}

      <SubmitButton label="Create operator account" />
    </form>
  );
}
