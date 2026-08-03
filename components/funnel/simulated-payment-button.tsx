"use client";

import { useFormStatus } from "react-dom";

export function SimulatedPaymentButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-disabled={pending} className="funnel-primary w-full disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Completing test payment…" : "Simulate successful payment"}</button>;
}
