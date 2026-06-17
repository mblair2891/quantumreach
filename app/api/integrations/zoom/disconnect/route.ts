import { NextResponse } from "next/server";
import { requireWorkspaceAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/audit/service";
export async function POST(request: Request) { const body = await request.json().catch(()=>({})); const { user, workspace } = await requireWorkspaceAdmin(String(body.workspaceId||"")); const i=await prisma.workspaceMeetingIntegration.findUnique({where:{workspaceId_provider:{workspaceId:workspace.id,provider:"ZOOM"}}}); if(i) { await prisma.workspaceMeetingIntegration.update({where:{id:i.id}, data:{status:"REVOKED", disconnectedAt:new Date(), safeFailureMessage:"Disconnected by workspace admin."}}); await audit(workspace.id,"zoom.integration_disconnected","WorkspaceMeetingIntegration",i.id,user.id,{provider:"ZOOM"}); } return NextResponse.json({ok:true}); }
