import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireWorkspaceAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";

export default async function Page() {
  const { workspace } = await requireWorkspaceAdmin();
  const [members, tasks, failedRecordings, recentAudit] = await Promise.all([
    prisma.workspaceMember.count({ where: { workspaceId: workspace.id, status: "ACTIVE" } }),
    prisma.task.count({ where: { workspaceId: workspace.id, status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] } } }),
    prisma.meetingTranscriptionJob.count({ where: { workspaceId: workspace.id, status: "FAILED" } }),
    prisma.auditLog.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  return <div className="space-y-6"><header><p className="text-sm font-medium text-slate-500">Workspace admin</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Admin and operational controls</h1><p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">Workspace-scoped visibility for roles, processing health, audit activity, and private-beta setup. Platform-wide diagnostics live in the allowlisted operator area.</p></header><section className="grid gap-4 md:grid-cols-3"><Card><CardHeader><CardDescription>Active members</CardDescription><CardTitle>{members}</CardTitle></CardHeader></Card><Card><CardHeader><CardDescription>Open tasks</CardDescription><CardTitle>{tasks}</CardTitle></CardHeader></Card><Card><CardHeader><CardDescription>Failed transcription jobs</CardDescription><CardTitle>{failedRecordings}</CardTitle></CardHeader></Card></section><Card><CardHeader><CardTitle>Admin actions</CardTitle><CardDescription>Safe operations only; secrets and provider tokens are never shown.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link href="/dashboard/settings">Workspace settings</Link></Button><Button asChild variant="outline"><Link href="/dashboard/audit">Audit log</Link></Button><Button asChild variant="outline"><Link href="/dashboard/operator">Operator dashboard</Link></Button></CardContent></Card><Card><CardHeader><CardTitle>Recent audit activity</CardTitle><CardDescription>Workspace-scoped human-readable events.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm">{recentAudit.map((event) => <p key={event.id} className="rounded-xl border p-3 dark:border-slate-800">{event.action} · {event.entityType} · {event.createdAt.toLocaleString()}</p>)}{recentAudit.length === 0 ? <p>No audit events recorded yet.</p> : null}</CardContent></Card></div>;
}
