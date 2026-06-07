"use client";

import { useMemo, useState, useTransition } from "react";
import { buildTxtImportPreview, knowledgeImportAuthorityLevels, knowledgeImportPriorities, knowledgeImportStatuses, knowledgeImportWorkflowStages, TXT_IMPORT_MAX_FILE_SIZE_BYTES, TXT_IMPORT_MAX_FILES, validateTxtImportFile, validateTxtImportFileCount, type TxtImportPreview } from "@/lib/knowledge/import";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function FieldLabel({ children }: { children: React.ReactNode }) { return <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{children}</label>; }
function Select({ value, options, onChange }: { value: string; options: readonly string[]; onChange: (value: string) => void }) { return <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm dark:bg-slate-950">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>; }

export function KnowledgeImportForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  const [documents, setDocuments] = useState<TxtImportPreview[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const payload = useMemo(() => JSON.stringify({ documents }), [documents]);

  async function loadFiles(fileList: FileList | null) {
    setMessage(null);
    if (!fileList) return;
    const files = Array.from(fileList);
    const countError = validateTxtImportFileCount(files.length + documents.length);
    if (countError) { setMessage(countError); return; }
    const errors = files.map(validateTxtImportFile).filter(Boolean);
    if (errors.length) { setMessage(errors.join(" ")); return; }
    const previews = await Promise.all(files.map(async (file) => buildTxtImportPreview({ clientId: `${file.name}-${file.size}-${file.lastModified}`, name: file.name, type: file.type || "text/plain", size: file.size, text: await file.text() })));
    setDocuments((current) => [...current, ...previews]);
  }

  function update(index: number, patch: Partial<TxtImportPreview>) { setDocuments((current) => current.map((doc, docIndex) => docIndex === index ? { ...doc, ...patch } : doc)); }
  function toggleStage(index: number, stage: TxtImportPreview["workflowStages"][number]) { setDocuments((current) => current.map((doc, docIndex) => docIndex !== index ? doc : { ...doc, workflowStages: doc.workflowStages.includes(stage) ? doc.workflowStages.filter((item) => item !== stage) : [...doc.workflowStages, stage] })); }
  function submit(formData: FormData) { startTransition(async () => action(formData)); }

  return <div className="space-y-5"><Card><CardHeader><CardTitle>Upload .txt source files</CardTitle><CardDescription>Import up to {TXT_IMPORT_MAX_FILES} text files. Each file must be {Math.round(TXT_IMPORT_MAX_FILE_SIZE_BYTES / 1024)} KB or smaller. Files are read locally for preview, then validated again on import.</CardDescription></CardHeader><CardContent className="space-y-4"><Input type="file" accept=".txt,text/plain" multiple onChange={(event) => void loadFiles(event.target.files)} />{message ? <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">{message}</p> : null}<p className="text-sm text-slate-500 dark:text-slate-400">Default status is <strong>DRAFT</strong>. Choose ACTIVE only after reviewing the source and metadata.</p></CardContent></Card>
  {documents.length ? <form action={submit} className="space-y-4"><input type="hidden" name="payload" value={payload} />{documents.map((doc, index) => <Card key={doc.clientId} className="overflow-hidden"><CardHeader className="border-b dark:border-slate-800"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-xl">{doc.sourceFileName}</CardTitle><CardDescription>{doc.sourceText.length.toLocaleString()} characters · {doc.workflowStages.length} suggested workflow stages</CardDescription></div><Button type="button" variant="outline" onClick={() => setDocuments((current) => current.filter((_, docIndex) => docIndex !== index))}>Remove file</Button></div></CardHeader><CardContent className="space-y-5 pt-5"><div className="grid gap-3 md:grid-cols-2"><FieldLabel>Title<Input value={doc.title} onChange={(event) => update(index, { title: event.target.value })} required /></FieldLabel><FieldLabel>Version<Input value={doc.version} onChange={(event) => update(index, { version: event.target.value })} required /></FieldLabel><FieldLabel>Description<Input value={doc.description} onChange={(event) => update(index, { description: event.target.value })} /></FieldLabel><FieldLabel>Status<Select value={doc.status} options={knowledgeImportStatuses} onChange={(value) => update(index, { status: value as TxtImportPreview["status"] })} /></FieldLabel><FieldLabel>Document type<Select value={doc.documentType} options={knowledgeImportAuthorityLevels} onChange={(value) => update(index, { documentType: value as TxtImportPreview["documentType"] })} /></FieldLabel><FieldLabel>Authority level<Select value={doc.authorityLevel} options={knowledgeImportAuthorityLevels} onChange={(value) => update(index, { authorityLevel: value as TxtImportPreview["authorityLevel"] })} /></FieldLabel><FieldLabel>Priority<Select value={doc.priority} options={knowledgeImportPriorities} onChange={(value) => update(index, { priority: value as TxtImportPreview["priority"] })} /></FieldLabel><FieldLabel>Source file<Input value={doc.sourceFileName} onChange={(event) => update(index, { sourceFileName: event.target.value })} required /></FieldLabel></div><div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Workflow stages</p><div className="grid gap-2 md:grid-cols-3">{knowledgeImportWorkflowStages.map((stage) => <label key={stage} className="flex items-center gap-2 rounded-xl border p-2 text-sm dark:border-slate-800"><input type="checkbox" checked={doc.workflowStages.includes(stage)} onChange={() => toggleStage(index, stage)} />{stage}</label>)}</div></div><details className="rounded-xl border p-3 dark:border-slate-800"><summary className="cursor-pointer text-sm font-medium">Preview source text</summary><p className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{doc.sourceText}</p></details></CardContent></Card>)}<div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={isPending || !documents.length}>{isPending ? "Importing…" : `Import ${documents.length} document${documents.length === 1 ? "" : "s"}`}</Button><Button type="button" variant="outline" onClick={() => setDocuments([])}>Clear preview</Button></div></form> : null}</div>;
}
