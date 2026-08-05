"use server";

import { headers } from "next/headers";
import { completeAccountSetup } from "@/lib/auth/account-setup";
import { auth } from "@/lib/auth/better-auth";

export async function completeAccountSetupAction(form: FormData) {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirmPassword") ?? "");
  const firstName = String(form.get("firstName") ?? "");
  const lastName = String(form.get("lastName") ?? "");
  const username = String(form.get("username") ?? "").trim() || null;

  if (password !== confirm) return { error: "Passwords do not match." };

  try {
    const result = await completeAccountSetup({
      rawToken: token,
      password,
      firstName,
      lastName,
      username,
    });

    // Establish Better Auth session after credentials were created.
    await auth.api.signInEmail({
      body: { email: result.email, password },
      headers: headers(),
    });

    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SETUP_FAILED";
    if (message.startsWith("SETUP_TOKEN_")) {
      return { error: "This setup link is no longer valid. Request a new one or sign in." };
    }
    if (message.includes("already exists")) {
      return { error: "An account with this email already exists. Sign in instead." };
    }
    if (message.includes("username")) {
      return { error: message };
    }
    return { error: message.length < 160 ? message : "Could not complete account setup." };
  }
}
