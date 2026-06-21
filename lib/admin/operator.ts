import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";

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
  const context = await requireWorkspaceAccess();
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? context.user.email;
  if (!isOperatorEmail(email)) redirect("/dashboard");
  return { ...context, operatorEmail: email };
}
