import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { CopyInvitationButton } from "@/components/meetings/copy-invitation-button";
import { getCurrentWorkspace } from "@/lib/workspaces/service";
import {
  authorizeMeetingJoin,
  createMeeting,
  createMeetingInvitation,
  endMeeting,
  getMeetingDetail,
  getMeetingFormOptions,
  listMeetings,
  revokeMeetingInvitation,
  updateMeeting
} from "@/lib/meetings/service";

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Select({ name, children, defaultValue = "" }: { name: string; children: React.ReactNode; defaultValue?: string | null }) {
  return <select name={name} defaultValue={defaultValue ?? ""} className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm dark:bg-slate-950">{children}</select>;
}

export async function MeetingsListPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;
  const meetings = await listMeetings(workspace.id);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold">Meetings</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Workspace-authorized LiveKit meetings linked to your CRM and call workflow.</p></div><Button href="/dashboard/meetings/new">New meeting</Button></div>
    <Card><CardHeader><CardTitle>{meetings.length} workspace meetings</CardTitle><CardDescription>Participant history is retained for workflow and audit; live participant state comes directly from LiveKit.</CardDescription></CardHeader><CardContent className="space-y-3">
      {meetings.map((meeting) => <Link key={meeting.id} href={`/dashboard/meetings/${meeting.id}`} className="block rounded-xl border p-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><p className="font-semibold">{meeting.title}</p><span className="rounded-full border px-2 py-0.5 text-xs">{label(meeting.status)}</span></div><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{meeting.scheduledAt?.toLocaleString() ?? "Unscheduled"} · Host: {[meeting.host.firstName, meeting.host.lastName].filter(Boolean).join(" ") || meeting.host.email}</p><p className="mt-1 text-xs text-slate-500">{meeting.opportunity?.name ?? meeting.lead?.name ?? meeting.company?.name ?? "No CRM context"}</p></div><div className="text-right text-sm text-slate-500"><p>{meeting._count.participants} participant records</p><p>{meeting._count.invitations} invitations</p></div></div>
      </Link>)}
      {meetings.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">No meetings have been created in this workspace.</p> : null}
    </CardContent></Card>
  </div>;
}

export async function NewMeetingPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;
  const options = await getMeetingFormOptions(workspace.id);
  async function create(formData: FormData) {
    "use server";
    const workspace = await getCurrentWorkspace();
    if (!workspace) return;
    const meeting = await createMeeting(workspace.id, {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      scheduledAt: String(formData.get("scheduledAt") ?? ""),
      leadId: String(formData.get("leadId") ?? ""),
      contactId: String(formData.get("contactId") ?? ""),
      companyId: String(formData.get("companyId") ?? ""),
      opportunityId: String(formData.get("opportunityId") ?? ""),
      callSessionId: String(formData.get("callSessionId") ?? "")
    });
    redirect(`/dashboard/meetings/${meeting.id}`);
  }
  return <div className="space-y-6"><div><Link href="/dashboard/meetings" className="text-sm text-slate-500 hover:underline">← Back to meetings</Link><h1 className="mt-2 text-3xl font-semibold">New meeting</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Room names and public slugs are generated securely on the server.</p></div>
    <Card><CardHeader><CardTitle>Meeting details</CardTitle><CardDescription>All linked records are validated against the active workspace.</CardDescription></CardHeader><form action={create} className="grid gap-4 md:grid-cols-2">
      <label className="grid gap-1 text-sm font-medium md:col-span-2">Title<Input name="title" required maxLength={160} /></label>
      <label className="grid gap-1 text-sm font-medium md:col-span-2">Description<Textarea name="description" maxLength={2000} /></label>
      <label className="grid gap-1 text-sm font-medium">Scheduled time<Input name="scheduledAt" type="datetime-local" /></label>
      <label className="grid gap-1 text-sm font-medium">Lead<Select name="leadId"><option value="">No lead</option>{options.leads.map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Contact<Select name="contactId"><option value="">No contact</option>{options.contacts.map((record) => <option key={record.id} value={record.id}>{record.firstName} {record.lastName}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Company<Select name="companyId"><option value="">No company</option>{options.companies.map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Opportunity<Select name="opportunityId"><option value="">No opportunity</option>{options.opportunities.map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Call session<Select name="callSessionId"><option value="">No call session</option>{options.callSessions.map((record) => <option key={record.id} value={record.id}>{label(record.provider)} · {record.callDate?.toLocaleString() ?? "No date"}</option>)}</Select></label>
      <Button type="submit" className="md:col-span-2 md:w-fit">Create meeting</Button>
    </form></Card>
  </div>;
}

export async function MeetingDetailPage({ id, invitationToken }: { id: string; invitationToken?: string }) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;
  const [meeting, options] = await Promise.all([getMeetingDetail(workspace.id, id), getMeetingFormOptions(workspace.id)]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const invitationUrl = invitationToken ? `${appUrl}/meet/${meeting.slug}?token=${encodeURIComponent(invitationToken)}` : null;

  async function createInvitation(formData: FormData) {
    "use server";
    const workspace = await getCurrentWorkspace();
    if (!workspace) return;
    const { token } = await createMeetingInvitation(workspace.id, id, String(formData.get("expiresAt") ?? ""));
    redirect(`/dashboard/meetings/${id}?invitation=${encodeURIComponent(token)}`);
  }
  async function revoke(formData: FormData) {
    "use server";
    const workspace = await getCurrentWorkspace();
    if (!workspace) return;
    await revokeMeetingInvitation(workspace.id, id, String(formData.get("invitationId")));
    revalidatePath(`/dashboard/meetings/${id}`);
  }
  async function update(formData: FormData) {
    "use server";
    const workspace = await getCurrentWorkspace();
    if (!workspace) return;
    await updateMeeting(workspace.id, id, {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      scheduledAt: String(formData.get("scheduledAt") ?? ""),
      leadId: String(formData.get("leadId") ?? ""),
      contactId: String(formData.get("contactId") ?? ""),
      companyId: String(formData.get("companyId") ?? ""),
      opportunityId: String(formData.get("opportunityId") ?? ""),
      callSessionId: String(formData.get("callSessionId") ?? "")
    });
    revalidatePath(`/dashboard/meetings/${id}`);
  }
  async function end() {
    "use server";
    const authorization = await authorizeMeetingJoin({ meetingId: id });
    await endMeeting(authorization);
    revalidatePath(`/dashboard/meetings/${id}`);
  }

  return <div className="space-y-6"><div><Link href="/dashboard/meetings" className="text-sm text-slate-500 hover:underline">← Back to meetings</Link><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold">{meeting.title}</h1><span className="rounded-full border px-3 py-1 text-xs font-medium">{label(meeting.status)}</span></div><p className="mt-2 text-slate-600 dark:text-slate-300">{meeting.description || "No description"}</p></div>
    {invitationUrl ? <Card className="border-blue-300 dark:border-blue-500/40"><CardHeader><CardTitle>Invitation created</CardTitle><CardDescription>This plaintext token is shown once. Only its SHA-256 hash is stored.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3"><Input readOnly value={invitationUrl} className="min-w-0 flex-1" /><CopyInvitationButton value={invitationUrl} /></CardContent></Card> : null}
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2"><CardHeader><CardTitle>Meeting overview</CardTitle></CardHeader><CardContent className="grid gap-2 text-sm md:grid-cols-2"><p><span className="font-medium">Scheduled:</span> {meeting.scheduledAt?.toLocaleString() ?? "—"}</p><p><span className="font-medium">Started:</span> {meeting.startedAt?.toLocaleString() ?? "—"}</p><p><span className="font-medium">Ended:</span> {meeting.endedAt?.toLocaleString() ?? "—"}</p><p><span className="font-medium">Host:</span> {[meeting.host.firstName, meeting.host.lastName].filter(Boolean).join(" ") || meeting.host.email}</p><p><span className="font-medium">Lead:</span> {meeting.lead ? <Link className="underline" href={`/dashboard/leads/${meeting.lead.id}`}>{meeting.lead.name}</Link> : "—"}</p><p><span className="font-medium">Contact:</span> {meeting.contact ? <Link className="underline" href={`/dashboard/contacts/${meeting.contact.id}`}>{meeting.contact.firstName} {meeting.contact.lastName}</Link> : "—"}</p><p><span className="font-medium">Company:</span> {meeting.company ? <Link className="underline" href={`/dashboard/companies/${meeting.company.id}`}>{meeting.company.name}</Link> : "—"}</p><p><span className="font-medium">Opportunity:</span> {meeting.opportunity ? <Link className="underline" href={`/dashboard/opportunities/${meeting.opportunity.id}`}>{meeting.opportunity.name}</Link> : "—"}</p><p><span className="font-medium">CallSession:</span> {meeting.callSession ? <Link className="underline" href={`/dashboard/calls/${meeting.callSession.id}`}>{label(meeting.callSession.provider)} call</Link> : "—"}</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Room actions</CardTitle><CardDescription>Joining requests a short-lived token only at room entry.</CardDescription></CardHeader><CardContent className="space-y-3">{meeting.status !== "ENDED" && meeting.status !== "CANCELED" ? <Button href={`/dashboard/meetings/${meeting.id}/room`} className="w-full">Open room</Button> : null}{meeting.status !== "ENDED" ? <form action={end}><Button type="submit" variant="outline" className="w-full border-red-300 text-red-700 dark:text-red-300">End meeting</Button></form> : null}</CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Edit meeting</CardTitle><CardDescription>Linked CRM and CallSession records remain workspace-scoped.</CardDescription></CardHeader><form action={update} className="grid gap-4 md:grid-cols-2">
      <label className="grid gap-1 text-sm font-medium md:col-span-2">Title<Input name="title" required maxLength={160} defaultValue={meeting.title} /></label>
      <label className="grid gap-1 text-sm font-medium md:col-span-2">Description<Textarea name="description" maxLength={2000} defaultValue={meeting.description ?? ""} /></label>
      <label className="grid gap-1 text-sm font-medium">Scheduled time<Input name="scheduledAt" type="datetime-local" defaultValue={meeting.scheduledAt ? new Date(meeting.scheduledAt.getTime() - meeting.scheduledAt.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""} /></label>
      <label className="grid gap-1 text-sm font-medium">Lead<Select name="leadId" defaultValue={meeting.leadId}><option value="">No lead</option>{options.leads.map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Contact<Select name="contactId" defaultValue={meeting.contactId}><option value="">No contact</option>{options.contacts.map((record) => <option key={record.id} value={record.id}>{record.firstName} {record.lastName}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Company<Select name="companyId" defaultValue={meeting.companyId}><option value="">No company</option>{options.companies.map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Opportunity<Select name="opportunityId" defaultValue={meeting.opportunityId}><option value="">No opportunity</option>{options.opportunities.map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Call session<Select name="callSessionId" defaultValue={meeting.callSessionId}><option value="">No call session</option>{meeting.callSession ? <option value={meeting.callSession.id}>{label(meeting.callSession.provider)} · {meeting.callSession.callDate?.toLocaleString() ?? "No date"}</option> : null}{options.callSessions.filter((record) => record.id !== meeting.callSessionId).map((record) => <option key={record.id} value={record.id}>{label(record.provider)} · {record.callDate?.toLocaleString() ?? "No date"}</option>)}</Select></label>
      <Button type="submit" className="md:col-span-2 md:w-fit">Save meeting</Button>
    </form></Card>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Guest invitations</CardTitle><CardDescription>Invitation tokens are high entropy, meeting-specific, expirable, and revocable.</CardDescription></CardHeader><CardContent className="space-y-4"><form action={createInvitation} className="flex flex-wrap items-end gap-3"><label className="grid flex-1 gap-1 text-sm">Expires at<Input name="expiresAt" type="datetime-local" /></label><Button type="submit">Create invitation</Button></form>{meeting.invitations.map((invitation) => <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm dark:border-slate-800"><div><p>{invitation.revokedAt ? "Revoked" : invitation.expiresAt && invitation.expiresAt <= new Date() ? "Expired" : "Active"} invitation</p><p className="text-xs text-slate-500">{invitation.expiresAt?.toLocaleString() ?? "No expiration"}</p></div>{!invitation.revokedAt ? <form action={revoke}><input type="hidden" name="invitationId" value={invitation.id} /><Button type="submit" variant="ghost">Revoke</Button></form> : null}</div>)}{meeting.invitations.length === 0 ? <p className="text-sm text-slate-500">No guest invitations.</p> : null}</CardContent></Card>
      <Card><CardHeader><CardTitle>Participant history</CardTitle><CardDescription>These records support workflow history; they do not drive the live room grid.</CardDescription></CardHeader><CardContent className="space-y-2">{meeting.participants.map((participant) => <div key={participant.id} className="rounded-xl border p-3 text-sm dark:border-slate-800"><div className="flex justify-between gap-3"><span className="font-medium">{participant.displayName}</span><span>{label(participant.role)}</span></div><p className="mt-1 text-xs text-slate-500">Joined {participant.joinedAt?.toLocaleString() ?? "—"} · Left {participant.leftAt?.toLocaleString() ?? "—"}</p></div>)}{meeting.participants.length === 0 ? <p className="text-sm text-slate-500">No participants have joined.</p> : null}</CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Recent meeting activity</CardTitle><CardDescription>Safe lifecycle events only; credentials and invitation tokens are never recorded.</CardDescription></CardHeader><CardContent className="space-y-2">{meeting.events.map((event) => <div key={event.id} className="flex flex-wrap justify-between gap-2 rounded-xl border p-3 text-sm dark:border-slate-800"><span>{label(event.type)}{event.participant ? ` · ${event.participant.displayName}` : ""}</span><span className="text-slate-500">{event.occurredAt.toLocaleString()}</span></div>)}{meeting.events.length === 0 ? <p className="text-sm text-slate-500">No meeting activity yet.</p> : null}</CardContent></Card>
  </div>;
}
