"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeAccountSetupAction } from "@/app/setup/account/actions";

export function AccountSetupForm({
  token,
  email,
  defaultFirstName,
  defaultLastName,
}: {
  token: string;
  email: string;
  defaultFirstName: string;
  defaultLastName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    form.set("token", token);
    try {
      const result = await completeAccountSetupAction(form);
      if (result?.error) {
        setError(result.error);
        setPending(false);
        return;
      }
      // Server sets session cookie via Better Auth sign-in after create; land on app resolver.
      router.push("/app");
      router.refresh();
    } catch {
      setError("Could not complete setup. Please try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
        Account email: <strong>{email}</strong>
      </p>
      <label className="block text-sm font-medium text-slate-800">
        First name
        <input
          name="firstName"
          required
          defaultValue={defaultFirstName}
          autoComplete="given-name"
          className="qr-field mt-1"
        />
      </label>
      <label className="block text-sm font-medium text-slate-800">
        Last name
        <input
          name="lastName"
          required
          defaultValue={defaultLastName}
          autoComplete="family-name"
          className="qr-field mt-1"
        />
      </label>
      <label className="block text-sm font-medium text-slate-800">
        Username <span className="font-normal text-slate-600">(optional)</span>
        <input
          name="username"
          pattern="[a-zA-Z0-9_]{3,32}"
          autoComplete="username"
          className="qr-field mt-1"
          placeholder="optional_login_handle"
        />
      </label>
      <label className="block text-sm font-medium text-slate-800">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className="qr-field mt-1"
        />
      </label>
      <label className="block text-sm font-medium text-slate-800">
        Confirm password
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Re-enter password"
          className="qr-field mt-1"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account and continue"}
      </button>
    </form>
  );
}
