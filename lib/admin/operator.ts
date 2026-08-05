import { redirect } from "next/navigation";
import { requireUserProfile } from "@/lib/auth/rbac";

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isOperatorEmail(email?: string | null) {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

export async function requireOperatorAccess() {
  // Platform operators must be able to repair/bootstrap their first workspace.
  // Requiring workspace access here made that recovery path impossible.
  const user = await requireUserProfile();
  if (!isOperatorEmail(user.email)) redirect("/dashboard");
  return { user, operatorEmail: user.email };
}
