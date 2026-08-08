"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth/client";
import { normalizeSignInIdentifier } from "@/lib/auth/identifier";

/** Light, high-contrast fields — sign-in stays readable even when the OS theme is dark. */
const fieldClassName =
  "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-950 [color-scheme:light] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:border-slate-300 dark:bg-white dark:text-slate-950 dark:placeholder:text-slate-500";

export function SignInForm({ nextPath = "/app" }: { nextPath?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("identifier") ?? "");
    const password = String(form.get("password") ?? "");
    const { kind, value } = normalizeSignInIdentifier(identifier);

    if (!value) {
      setError("Enter your email or username.");
      setPending(false);
      return;
    }

    try {
      const result =
        kind === "email"
          ? await signIn.email({ email: value, password })
          : await signIn.username({ username: value, password });

      if (result.error) {
        setError(result.error.message || "Invalid email/username or password.");
        setPending(false);
        return;
      }

      // Always resolve post-login destination server-side (/app → operator/platform vs dashboard).
      const destination = new URL("/app", window.location.origin);
      if (nextPath && nextPath !== "/app" && nextPath.startsWith("/")) {
        destination.searchParams.set("returnUrl", nextPath);
      }
      router.push(`${destination.pathname}${destination.search}`);
      router.refresh();
    } catch {
      setError("Sign in failed. Please try again.");
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
      <label className="block text-sm font-medium text-slate-700">
        Email or username
        <input
          name="identifier"
          type="text"
          required
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="you@company.com or username"
          className={fieldClassName}
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="current-password"
          placeholder="Your password"
          className={fieldClassName}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
