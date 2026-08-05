"use client";

import { useState } from "react";
import { deleteTestSubscriberAction } from "./actions";

export function DeleteTestSubscriberForm() {
  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);
    const form = new FormData(event.currentTarget);
    const result = await deleteTestSubscriberAction(form);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.message);
    setEmail("");
    setConfirm("");
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-3">
      {error ? (
        <p role="alert" className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="rounded-lg bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}
      <label className="text-sm text-slate-300">
        Subscriber email
        <input
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-50"
          placeholder="test@example.com"
        />
      </label>
      <label className="text-sm text-slate-300">
        Type email again to confirm
        <input
          name="confirm"
          type="email"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-50"
        />
      </label>
      <button
        type="submit"
        disabled={pending || !email || email !== confirm}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete test subscriber"}
      </button>
    </form>
  );
}
