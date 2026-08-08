"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/better-auth";
import {
  assertOperatorBootstrapEnvironment,
  bootstrapOperator,
  getOperatorBootstrapGate,
} from "@/lib/auth/operator-bootstrap";

export type BootstrapOperatorActionState = {
  error?: string;
};

export async function bootstrapOperatorAction(
  _prev: BootstrapOperatorActionState | undefined,
  form: FormData,
): Promise<BootstrapOperatorActionState> {
  try {
    assertOperatorBootstrapEnvironment();
  } catch {
    return { error: "Operator bootstrap is unavailable in this environment." };
  }

  const gate = await getOperatorBootstrapGate();
  if (!gate.available) {
    return { error: gate.blockedReason ?? "Operator bootstrap is not available." };
  }

  const email = String(form.get("email") ?? "");
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const confirmPassword = String(form.get("confirmPassword") ?? "");
  const bootstrapSecret = String(form.get("bootstrapSecret") ?? "");

  try {
    const result = await bootstrapOperator({
      email,
      username,
      password,
      confirmPassword,
      bootstrapSecret: gate.requiresBootstrapSecret ? bootstrapSecret : null,
    });

    // Establish session so the operator lands on /platform without a second form.
    await auth.api.signInEmail({
      body: { email: result.email, password },
      headers: headers(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "BOOTSTRAP_FAILED";
    if (message.length < 200) return { error: message };
    return { error: "Could not create the operator account." };
  }

  redirect("/platform");
}
