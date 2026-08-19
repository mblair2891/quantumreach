import { NextResponse } from "next/server";
import { isRedirectError } from "next/dist/client/components/redirect";
import { requireWorkspaceAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { createGoogleOAuthState } from "@/lib/outbound/google-oauth-state";
import { googleAuthorizationUrl, inboxEmailMatchesDomain, isGoogleOAuthConfigured } from "@/lib/outbound/google-oauth";

function fail(origin: string, message: string) {
  return NextResponse.redirect(new URL(`/dashboard/sending/outbound?error=${encodeURIComponent(message)}`, origin));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const inboxId = url.searchParams.get("inboxId");
    const { user, workspace } = await requireWorkspaceAdmin(url.searchParams.get("workspaceId") || undefined);
    if (!isGoogleOAuthConfigured()) {
      return fail(url.origin, "Google OAuth is not configured in this environment.");
    }
    if (!inboxId) return fail(url.origin, "Choose an inbox to connect.");
    const inbox = await prisma.inbox.findFirst({
      where: { id: inboxId, workspaceId: workspace.id },
      include: { domain: true },
    });
    if (!inbox) return fail(url.origin, "Inbox was not found.");
    if (!inboxEmailMatchesDomain(inbox.emailAddress, inbox.domain.domain)) {
      return fail(url.origin, "Inbox address must match its sending domain.");
    }
    const state = createGoogleOAuthState(workspace.id, user.id, inbox.id);
    return NextResponse.redirect(googleAuthorizationUrl(state, inbox.emailAddress));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return fail(url.origin, "Workspace admin access is required to connect Google.");
  }
}
