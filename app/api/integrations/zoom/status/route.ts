import { NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
export async function GET(request: Request) { const workspaceId = new URL(request.url).searchParams.get("workspaceId") || undefined; const { workspace } = await requireWorkspaceAccess(workspaceId); const i = await prisma.workspaceMeetingIntegration.findUnique({ where:{workspaceId_provider:{workspaceId:workspace.id, provider:"ZOOM"}}, select:{status:true,providerAccountId:true,providerAccountName:true,connectedAt:true,lastRefreshedAt:true,safeFailureMessage:true} }); return NextResponse.json({ zoom: i }); }
