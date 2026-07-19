import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getActiveWorkspaceMembershipForUser, requireUserProfile } from "@/lib/auth/rbac";
import { isOperatorEmail } from "@/lib/admin/operator";
import { resolveAuthenticatedLandingRoute } from "@/lib/auth/landing";

export default async function AuthenticatedEntry({ searchParams }: { searchParams?: { returnUrl?: string } }) {
  const user = await requireUserProfile();
  const [membership, clerkUser] = await Promise.all([getActiveWorkspaceMembershipForUser(user.id), currentUser()]);
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? user.email;
  redirect(resolveAuthenticatedLandingRoute({
    isOperator: isOperatorEmail(email),
    hasWorkspaceMembership: Boolean(membership),
    isPortalOnly: membership?.roleKey === "CLIENT",
    requestedPath: searchParams?.returnUrl,
  }));
}
