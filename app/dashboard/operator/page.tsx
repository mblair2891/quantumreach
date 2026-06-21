import { prisma } from "@/lib/db/prisma";
import { requireOperatorAccess } from "@/lib/admin/operator";
import { getBillingConfig } from "@/lib/billing/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Page() {
  await requireOperatorAccess();
  const [workspaces, users, failedWebhookEvents, failedTranscriptions, recentMeetings] = await Promise.all([
    prisma.workspace.count(),
    prisma.userProfile.count(),
    prisma.providerWebhookEvent.findMany({
      where: { status: "FAILED" },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, eventType: true, provider: true, safeFailureMessage: true, updatedAt: true },
    }),
    prisma.meetingTranscriptionJob.findMany({
      where: { status: "FAILED" },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, safeFailureMessage: true, updatedAt: true },
    }),
    prisma.meetingRoom.findMany({
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, title: true, status: true, provider: true, updatedAt: true },
    }),
  ]);
  const billing = getBillingConfig();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-slate-500">Internal operator area</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">System health and processing visibility</h1>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
          Allowlisted operators can inspect safe summaries without secrets, tokens, raw webhook signatures, or full provider payloads.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader><CardDescription>Workspaces</CardDescription><CardTitle>{workspaces}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Users</CardDescription><CardTitle>{users}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Failed webhooks</CardDescription><CardTitle>{failedWebhookEvents.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Billing</CardDescription><CardTitle>{billing.configured ? "Ready" : "Disabled"}</CardTitle></CardHeader></Card>
      </section>
      <Card>
        <CardHeader><CardTitle>Recent meetings</CardTitle><CardDescription>Lifecycle status for Zoom-first meeting operations.</CardDescription></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {recentMeetings.map((meeting) => <p key={meeting.id} className="rounded-xl border p-3 dark:border-slate-800">{meeting.title} · {meeting.provider} · {meeting.status} · {meeting.updatedAt.toLocaleString()}</p>)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Processing failures</CardTitle><CardDescription>Safe failure messages only.</CardDescription></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {failedWebhookEvents.map((event) => <p key={event.id} className="rounded-xl border p-3 dark:border-slate-800">Webhook {event.provider}:{event.eventType} · {event.safeFailureMessage ?? "No safe message"}</p>)}
          {failedTranscriptions.map((job) => <p key={job.id} className="rounded-xl border p-3 dark:border-slate-800">Transcription job · {job.safeFailureMessage ?? "No safe message"}</p>)}
          {failedWebhookEvents.length + failedTranscriptions.length === 0 ? <p>No failed webhook or transcription jobs found.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
