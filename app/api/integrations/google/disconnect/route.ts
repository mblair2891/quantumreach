import { NextResponse } from "next/server";
import { requireWorkspaceAdmin } from "@/lib/auth/rbac";
import { disconnectGoogleInbox } from "@/lib/outbound/google-oauth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const inboxId = typeof body.inboxId === "string" ? body.inboxId : "";
  const { user, workspace } = await requireWorkspaceAdmin(typeof body.workspaceId === "string" ? body.workspaceId : undefined);
  if (!inboxId) return NextResponse.json({ error: "inboxId is required." }, { status: 400 });
  try {
    await disconnectGoogleInbox(inboxId, workspace.id, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not disconnect Google." }, { status: 422 });
  }
}
