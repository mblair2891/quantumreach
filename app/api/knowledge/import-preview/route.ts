import { NextResponse } from "next/server";
import { getCurrentWorkspace } from "@/lib/workspaces/service";
import { buildKnowledgeFilePreview } from "@/lib/knowledge/extractors";
import { TXT_IMPORT_MAX_FILES, validateTxtImportFileCount } from "@/lib/knowledge/import";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Active workspace access is required before uploading knowledge files." }, { status: 401 });

  try {
    const formData = await request.formData();
    const files = formData.getAll("files").filter((value): value is File => value instanceof File);
    const countError = validateTxtImportFileCount(files.length);
    if (countError) return NextResponse.json({ error: countError }, { status: 400 });
    if (files.length > TXT_IMPORT_MAX_FILES) return NextResponse.json({ error: `Upload ${TXT_IMPORT_MAX_FILES} or fewer files at a time.` }, { status: 400 });

    const previews = [];
    const errors: string[] = [];
    for (const file of files) {
      try {
        previews.push(await buildKnowledgeFilePreview(file));
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `${file.name} could not be processed.`);
      }
    }
    if (!previews.length && errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    return NextResponse.json({ previews, errors });
  } catch {
    return NextResponse.json({ error: "Upload preview could not be created. Please review the files and try again." }, { status: 400 });
  }
}
