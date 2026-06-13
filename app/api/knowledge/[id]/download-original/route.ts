import { NextResponse } from "next/server";
import { getCurrentWorkspace } from "@/lib/workspaces/service";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/audit/service";
import { getKnowledgeOriginalFile, isWorkspaceKnowledgeStorageKey } from "@/lib/storage/r2";

export const runtime = "nodejs";

function safeDownloadName(fileName: string | null) {
  return (fileName || "knowledge-source-file").replace(/[\r\n"]/g, "_");
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Workspace access is required." }, { status: 401 });

  const { user } = await requireWorkspaceAccess(workspace.id);
  const document = await prisma.knowledgeDocument.findFirst({ where: { id: params.id, workspaceId: workspace.id }, select: { id: true, workspaceId: true, title: true, storageKey: true, sourceFileName: true, sourceMimeType: true, sourceFileSizeBytes: true } });
  if (!document?.storageKey || !isWorkspaceKnowledgeStorageKey(document.storageKey, workspace.id, document.id)) return NextResponse.json({ error: "Original file is not available for this document." }, { status: 404 });

  try {
    const stored = await getKnowledgeOriginalFile(document.storageKey);
    await audit(workspace.id, "knowledge.original_file_downloaded", "KnowledgeDocument", document.id, user.id, { documentId: document.id, sourceFileName: document.sourceFileName, sourceMimeType: document.sourceMimeType, sourceFileSizeBytes: document.sourceFileSizeBytes });
    return new Response(stored.body, {
      status: 200,
      headers: {
        "Content-Type": document.sourceMimeType || stored.headers.get("content-type") || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeDownloadName(document.sourceFileName)}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch {
    return NextResponse.json({ error: "Original file could not be downloaded. Please try again later." }, { status: 502 });
  }
}
