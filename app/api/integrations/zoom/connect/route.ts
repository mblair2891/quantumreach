import { NextResponse } from "next/server";
import { requireWorkspaceAdmin } from "@/lib/auth/rbac";
import { createZoomOAuthState } from "@/lib/meetings/providers/zoom-oauth-state";
import { zoomAuthorizationUrl } from "@/lib/meetings/providers/zoom";
export async function GET(request: Request) { const workspaceId = new URL(request.url).searchParams.get("workspaceId") || undefined; const { user, workspace } = await requireWorkspaceAdmin(workspaceId); const state = createZoomOAuthState(workspace.id, user.id); return NextResponse.redirect(zoomAuthorizationUrl(state)); }
