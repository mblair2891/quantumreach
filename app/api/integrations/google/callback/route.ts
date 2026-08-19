import { NextResponse } from "next/server";
import { isRedirectError } from "next/dist/client/components/redirect";
import { requireWorkspaceAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { verifyGoogleOAuthState } from "@/lib/outbound/google-oauth-state";
import { bindGoogleInbox, exchangeGoogleCode, fetchGoogleAccountEmail, inboxEmailMatchesDomain } from "@/lib/outbound/google-oauth";

function redirectOutbound(origin: string, query: string) {
  return NextResponse.redirect(new URL(`/dashboard/sending/outbound?${query}`, origin));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    if (url.searchParams.get("error")) {
      return redirectOutbound(url.origin, "google=error");
    }
    const state = verifyGoogleOAuthState(url.searchParams.get("state") || "");
    const code = url.searchParams.get("code");
    if (!code) throw new Error("Missing Google authorization code.");
    const { user, workspace } = await requireWorkspaceAdmin(state.workspaceId);
    if (user.id !== state.userId || workspace.id !== state.workspaceId) {
      throw new Error("OAuth callback workspace mismatch.");
    }
    const inbox = await prisma.inbox.findFirst({
      where: { id: state.inboxId, workspaceId: workspace.id },
      include: { domain: true },
    });
    if (!inbox) return redirectOutbound(url.origin, "error=" + encodeURIComponent("Inbox was not found."));
    if (!inboxEmailMatchesDomain(inbox.emailAddress, inbox.domain.domain)) {
      return redirectOutbound(url.origin, "google=mismatch");
    }
    const token = await exchangeGoogleCode(code);
    const googleAccountEmail = await fetchGoogleAccountEmail(token.accessToken);
    if (googleAccountEmail !== inbox.emailAddress.trim().toLowerCase()) {
      return redirectOutbound(url.origin, "google=mismatch");
    }
    await bindGoogleInbox({
      inboxId: inbox.id,
      workspaceId: workspace.id,
      connectedById: user.id,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      scopes: token.scopes,
      googleAccountEmail,
    });
    return redirectOutbound(url.origin, "google=connected");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return redirectOutbound(url.origin, "google=error");
  }
}
