import { NextResponse } from "next/server";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { prisma } from "@/lib/db/prisma";
import { importRowsFromBatch, rejectsCsv } from "@/lib/revenue-os/imports";

export async function GET(_request: Request, { params }: { params: { batchId: string } }) {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  const batch = await prisma.contactImportBatch.findFirst({
    where: { id: params.batchId, workspaceId: workspace.id },
    include: { rows: { orderBy: { rowNumber: "asc" } } },
  });
  if (!batch) return new NextResponse("Import batch not found.", { status: 404 });
  const csv = rejectsCsv(importRowsFromBatch(batch));
  const filename = `${(batch.fileName ?? "import").replace(/\.csv$/i, "")}-rejects.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
