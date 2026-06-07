import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentWorkspace } from "@/lib/workspaces/service";
import { deleteKnowledgeDocument, genericKnowledgeDeleteMessage, getKnowledgeDocument, KnowledgeDocumentDeleteError, regenerateKnowledgeChunks, setKnowledgeDocumentStatus, updateKnowledgeDocument } from "@/lib/knowledge/service";
import { KnowledgeForm } from "@/components/dashboard/knowledge-form";
import { KnowledgeDeleteAction } from "@/components/dashboard/knowledge-delete-action";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border px-2 py-1 text-xs font-medium dark:border-slate-700">{children}</span>;
}

export default async function KnowledgeDetailPage({ params, searchParams }: { params: { id: string }; searchParams?: { deleteError?: string } }) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;
  const document = await getKnowledgeDocument(workspace.id, params.id);
  const deleteError = searchParams?.deleteError;

  async function save(formData: FormData) {
    "use server";
    const workspace = await getCurrentWorkspace();
    if (!workspace) return;
    await updateKnowledgeDocument(workspace.id, params.id, { ...Object.fromEntries(formData.entries()), workflowStages: formData.getAll("workflowStages") });
    revalidatePath(`/dashboard/knowledge/${params.id}`);
  }

  async function activate() {
    "use server";
    const workspace = await getCurrentWorkspace();
    if (!workspace) return;
    await setKnowledgeDocumentStatus(workspace.id, params.id, "ACTIVE");
    revalidatePath(`/dashboard/knowledge/${params.id}`);
  }

  async function archive() {
    "use server";
    const workspace = await getCurrentWorkspace();
    if (!workspace) return;
    await setKnowledgeDocumentStatus(workspace.id, params.id, "ARCHIVED");
    revalidatePath(`/dashboard/knowledge/${params.id}`);
  }

  async function draft() {
    "use server";
    const workspace = await getCurrentWorkspace();
    if (!workspace) return;
    await setKnowledgeDocumentStatus(workspace.id, params.id, "DRAFT");
    revalidatePath(`/dashboard/knowledge/${params.id}`);
  }

  async function chunks() {
    "use server";
    const workspace = await getCurrentWorkspace();
    if (!workspace) return;
    await regenerateKnowledgeChunks(workspace.id, params.id);
    revalidatePath(`/dashboard/knowledge/${params.id}`);
  }

  async function deletePermanently() {
    "use server";
    const workspace = await getCurrentWorkspace();
    if (!workspace) return;
    let errorMessage: string | null = null;
    try {
      await deleteKnowledgeDocument(workspace.id, params.id);
    } catch (error) {
      errorMessage = error instanceof KnowledgeDocumentDeleteError ? error.message : genericKnowledgeDeleteMessage;
    }
    if (errorMessage) redirect(`/dashboard/knowledge/${params.id}?deleteError=${encodeURIComponent(errorMessage)}`);
    revalidatePath("/dashboard/knowledge");
    redirect("/dashboard/knowledge?deleted=1");
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/knowledge" className="text-sm text-slate-500 hover:underline">← Back to knowledge</Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">{document.title}</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300">{document.description ?? "Governed source-of-truth document"}</p>
          </div>
          <div className="flex flex-wrap gap-2"><Badge>{document.status}</Badge><Badge>{document.authorityLevel}</Badge><Badge>{document.priority}</Badge><Badge>v{document.version}</Badge></div>
        </div>
      </div>

      {deleteError ? <Card className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"><CardHeader><CardTitle>Document was not deleted</CardTitle><CardDescription>{deleteError}</CardDescription></CardHeader></Card> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card><CardHeader><CardTitle>Hierarchy</CardTitle><CardDescription>{document.documentType} · {document.authorityLevel}</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><p>Workflow stages: {Array.isArray(document.workflowStages) ? document.workflowStages.join(", ") : "—"}</p><p>Industry: {document.industry ?? "—"}</p><p>Offer line: {document.offerLine ?? "—"}</p><p>Approved: {document.approvedAt ? document.approvedAt.toLocaleString() : "Not approved"}</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Actions</CardTitle><CardDescription>Archived and draft documents are excluded from production generation.</CardDescription></CardHeader><CardContent className="space-y-3"><form action={activate}><Button type="submit">Approve / activate</Button></form><form action={draft}><Button type="submit" variant="outline">Move to draft</Button></form><form action={archive}><Button type="submit" variant="outline">Archive</Button></form><form action={chunks}><Button type="submit" variant="outline">Regenerate chunks</Button></form><KnowledgeDeleteAction action={deletePermanently} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Usage history</CardTitle><CardDescription>{document.usages.length} recorded source usages.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm">{document.usages.map((usage) => <p key={usage.id}>{usage.workflowStage} · {usage.entityType} · {usage.usedFor}</p>)}{document.usages.length === 0 ? <p className="text-slate-500">Not used by AI generation yet.</p> : null}</CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Generated chunks</CardTitle><CardDescription>Deterministic chunks preserve order, headings, hierarchy metadata, and status.</CardDescription></CardHeader><CardContent className="space-y-3">{document.chunks.map((chunk) => <details key={chunk.id} className="rounded-xl border p-4 dark:border-slate-800"><summary className="cursor-pointer font-medium">Chunk {chunk.chunkIndex + 1}: {chunk.heading ?? "Untitled"} · {chunk.characterCount} chars</summary><p className="mt-3 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{chunk.text}</p></details>)}</CardContent></Card>
      <KnowledgeForm action={save} document={document} />
    </div>
  );
}
