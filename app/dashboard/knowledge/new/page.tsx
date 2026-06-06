import { redirect } from "next/navigation";
import { getCurrentWorkspace } from "@/lib/workspaces/service";
import { createKnowledgeDocument } from "@/lib/knowledge/service";
import { KnowledgeForm } from "@/components/dashboard/knowledge-form";
export default async function NewKnowledgePage() {
  async function action(formData: FormData) { "use server"; const workspace = await getCurrentWorkspace(); if (!workspace) return; const created = await createKnowledgeDocument(workspace.id, { ...Object.fromEntries(formData.entries()), workflowStages: formData.getAll("workflowStages") }); redirect(`/dashboard/knowledge/${created.id}`); }
  return <div className="space-y-6"><div><h1 className="text-3xl font-semibold">Create knowledge document</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Manual text ingestion only. Upload, parsing, sync, and embeddings are deferred.</p></div><KnowledgeForm action={action} /></div>;
}
