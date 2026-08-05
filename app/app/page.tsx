import { redirect } from "next/navigation";
import { getActiveWorkspaceMembershipForUser, requireUserProfile } from "@/lib/auth/rbac";
import { isOperatorEmail } from "@/lib/admin/operator";
import { resolveAuthenticatedLandingRoute } from "@/lib/auth/landing";

export default async function AuthenticatedEntry({ searchParams }: { searchParams?: { returnUrl?: string } }) {
  const user = await requireUserProfile();
  const membership = await getActiveWorkspaceMembershipForUser(user.id);
  redirect(
    resolveAuthenticatedLandingRoute({
      isOperator: isOperatorEmail(user.email),
      hasWorkspaceMembership: Boolean(membership),
      isPortalOnly: membership?.roleKey === "CLIENT",
      requestedPath: searchParams?.returnUrl,
    }),
  );
}
