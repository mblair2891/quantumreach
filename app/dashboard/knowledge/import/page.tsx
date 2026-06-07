import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentWorkspace } from "@/lib/workspaces/service";
import { bulkCreateKnowledgeDocuments, listKnowledgeDocuments } from "@/lib/knowledge/service";
import { knowledgeBulkImportPayloadSchema } from "@/lib/validation/schemas";
import { KnowledgeImportForm } from "@/components/dashboard/knowledge-import-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function KnowledgeImportPage({ searchParams }: { searchParams?: { error?: string } }) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return <Card><CardHeader><CardTitle>No active workspace</CardTitle><CardDescription>Create or join a workspace before importing source-of-truth documents.</CardDescription></CardHeader></Card>;

  const existingDocuments = await listKnowledgeDocuments(workspace.id);

  async function importDocuments(formData: FormData) {
    "use server";
    const workspace = await getCurrentWorkspace();
    if (!workspace) return;
    let importedCount = 0;
    try {
      const rawPayload = String(formData.get("payload") ?? "");
      const parsed = knowledgeBulkImportPayloadSchema.parse(JSON.parse(rawPayload));
      const result = await bulkCreateKnowledgeDocuments(workspace.id, parsed);
      importedCount = result.importedCount;
      revalidatePath("/dashboard/knowledge");
    } catch (error) {
      if (error instanceof ZodError || error instanceof SyntaxError) redirect("/dashboard/knowledge/import?error=invalid-import-payload");
      redirect("/dashboard/knowledge/import?error=import-failed");
    }
    redirect(`/dashboard/knowledge?imported=${importedCount}`);
  }

  return <div className="space-y-6"><div><Link href="/dashboard/knowledge" className="text-sm text-slate-500 hover:underline">← Back to knowledge</Link><p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Bulk source-of-truth import</p><h1 className="text-3xl font-semibold">Import knowledge documents</h1><p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">Upload approved TXT, Markdown, PDF, or DOCX documents, review extracted text and deterministic metadata suggestions, edit hierarchy and workflow mapping, then import them into the active workspace as drafts unless you explicitly choose ACTIVE.</p></div>{searchParams?.error ? <Card className="border-amber-300 dark:border-amber-800"><CardHeader><CardTitle>Import could not be completed</CardTitle><CardDescription>Please review the selected files and required metadata, then try again.</CardDescription></CardHeader><CardContent><p className="text-sm text-amber-700 dark:text-amber-200">Unsupported, missing, or invalid import data was rejected safely.</p></CardContent></Card> : null}<KnowledgeImportForm action={importDocuments} existingDocuments={existingDocuments.map((document) => ({ id: document.id, title: document.title, version: document.version, status: document.status }))} /></div>;
}
