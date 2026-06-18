import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { CopyInvitationButton } from "@/components/meetings/copy-invitation-button";
import { CopyManagedInvitationButton } from "@/components/meetings/copy-managed-invitation-button";
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
import { listMeetingRecordings, requestRecordingConsent, reconcileRecording, startRecording, stopRecording } from "@/lib/meetings/recordings";
import { processTranscriptionJob } from "@/lib/meetings/transcription";

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
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold">Meetings</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Workspace-authorized meetings linked to your CRM and call workflow. Zoom is used by default when connected.</p></div><Button href="/dashboard/meetings/new">New meeting</Button></div>
    <Card><CardHeader><CardTitle>{meetings.length} workspace meetings</CardTitle><CardDescription>Participant history is retained for workflow and audit; runtime state comes directly from the selected meeting provider.</CardDescription></CardHeader><CardContent className="space-y-3">
      {meetings.map((meeting) => <Link key={meeting.id} href={`/dashboard/meetings/${meeting.id}`} className="block rounded-xl border p-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><p className="font-semibold">{meeting.title}</p><span className="rounded-full border px-2 py-0.5 text-xs">{label(meeting.status)}</span><span className="rounded-full border px-2 py-0.5 text-xs">{meeting.provider === "NATIVE_LIVEKIT" ? "Legacy native" : label(meeting.provider)}</span>{meeting.recordingPlanned ? <span className="rounded-full border border-blue-300 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300">Recording planned</span> : null}{meeting.lobbyEnabled ? <span className="rounded-full border border-violet-300 px-2 py-0.5 text-xs text-violet-700 dark:text-violet-300">Lobby enabled</span> : null}</div><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{meeting.scheduledAt?.toLocaleString() ?? "Unscheduled"} · Host: {[meeting.host.firstName, meeting.host.lastName].filter(Boolean).join(" ") || meeting.host.email}</p><p className="mt-1 text-xs text-slate-500">{meeting.opportunity?.name ?? meeting.lead?.name ?? meeting.company?.name ?? "No CRM context"}</p></div><div className="text-right text-sm text-slate-500"><p>{meeting._count.participants} participant records</p><p>{meeting._count.invitations} invitations</p></div></div>
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
      callSessionId: String(formData.get("callSessionId") ?? ""),
      recordingPreference: (formData.get("recordingPreference") === "LOCAL_UPLOAD" ? "LOCAL_UPLOAD" : formData.get("recordingPreference") === "ZOOM_CLOUD" ? "ZOOM_CLOUD" : "NONE"),
      recordingPlanned: String(formData.get("recordingPreference") || "NONE") !== "NONE",
      recordingConsentRequired: String(formData.get("recordingPreference") || "NONE") !== "NONE",
      lobbyEnabled: formData.get("lobbyEnabled") === "on",
      provider: "ZOOM",
      providerHostId: String(formData.get("providerHostId") ?? "")
    });
    redirect(`/dashboard/meetings/${meeting.id}`);
  }
  return <div className="space-y-6"><div><Link href="/dashboard/meetings" className="text-sm text-slate-500 hover:underline">← Back to meetings</Link><h1 className="mt-2 text-3xl font-semibold">New meeting</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Zoom is the only active meeting runtime. Connect Zoom to create new meetings; legacy native meetings are retained as read-only history.</p></div>
    <Card><CardHeader><CardTitle>Meeting details</CardTitle><CardDescription>All linked records are validated against the active workspace.</CardDescription></CardHeader><form action={create} className="grid gap-4 md:grid-cols-2">
      <label className="grid gap-1 text-sm font-medium md:col-span-2">Title<Input name="title" required maxLength={160} /></label>
      <label className="grid gap-1 text-sm font-medium md:col-span-2">Description<Textarea name="description" maxLength={2000} /></label>
      <label className="grid gap-1 text-sm font-medium">Scheduled time<Input name="scheduledAt" type="datetime-local" /></label>
      <div className="grid gap-1 text-sm font-medium"><span>Provider</span><div className="rounded-xl border border-input bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900">Zoom</div>{!options.zoomConnected ? <Button href="/dashboard/settings/integrations/meetings" variant="outline">Connect Zoom to create meetings</Button> : null}</div>
      <label className="grid gap-1 text-sm font-medium">Zoom host<Select name="providerHostId"><option value="">Default connected/admin Zoom host</option>{options.zoomHosts.map((host) => <option key={host.id} value={host.id}>{host.name} · {host.email}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Lead<Select name="leadId"><option value="">No lead</option>{options.leads.map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Contact<Select name="contactId"><option value="">No contact</option>{options.contacts.map((record) => <option key={record.id} value={record.id}>{record.firstName} {record.lastName}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Company<Select name="companyId"><option value="">No company</option>{options.companies.map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Opportunity<Select name="opportunityId"><option value="">No opportunity</option>{options.opportunities.map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Call session<Select name="callSessionId"><option value="">No call session</option>{options.callSessions.map((record) => <option key={record.id} value={record.id}>{label(record.provider)} · {record.callDate?.toLocaleString() ?? "No date"}</option>)}</Select></label>
      <fieldset className="grid gap-3 rounded-2xl border p-4 md:col-span-2 dark:border-slate-800"><legend className="px-1 text-sm font-semibold">Meeting settings</legend><label className="grid gap-1 text-sm"><span className="font-medium">Recording</span><select name="recordingPreference" className="rounded-md border bg-background px-3 py-2"><option value="NONE">Do not record</option><option value="ZOOM_CLOUD">Record to Zoom cloud</option><option value="LOCAL_UPLOAD">Record locally and upload afterward</option></select><span className="text-slate-500">Cloud recording must be available and enabled for the selected Zoom host’s account. For local recording, choose Record to this computer in Zoom, then upload the MP4 or M4A file here after the meeting.</span></label><label className="flex gap-3 text-sm"><input type="checkbox" name="recordingConsentRequired" checked readOnly /> <span><span className="font-medium">Require recording consent before entry</span><span className="block text-slate-500">Participants must consent before entering a recorded meeting.</span></span></label><label className="flex gap-3 text-sm"><input type="checkbox" name="lobbyEnabled" /> <span><span className="font-medium">Zoom waiting room enabled</span><span className="block text-slate-500">Guests wait in Zoom until admitted by the host.</span></span></label></fieldset>
      <Button type="submit" disabled={!options.zoomConnected} className="md:col-span-2 md:w-fit">{options.zoomConnected ? "Create Zoom meeting" : "Connect Zoom to create meetings"}</Button>
    </form></Card>
  </div>;
}

export async function MeetingDetailPage({ id, invitationUrl }: { id: string; invitationUrl?: string }) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;
  const [meeting, options, recordings] = await Promise.all([getMeetingDetail(workspace.id, id), getMeetingFormOptions(workspace.id), listMeetingRecordings(workspace.id, id)]);

  async function createInvitation(formData: FormData) {
    "use server";
    const workspace = await getCurrentWorkspace();
    if (!workspace) return;
    const { url } = await createMeetingInvitation(workspace.id, id, {
      displayName: String(formData.get("displayName") ?? ""),
      email: String(formData.get("email") ?? ""),
      role: String(formData.get("role") ?? ""),
      expiresAt: String(formData.get("expiresAt") ?? "")
    });
    redirect(`/dashboard/meetings/${id}?invitationUrl=${encodeURIComponent(url)}`);
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
      callSessionId: String(formData.get("callSessionId") ?? ""),
      recordingPreference: (formData.get("recordingPreference") === "LOCAL_UPLOAD" ? "LOCAL_UPLOAD" : formData.get("recordingPreference") === "ZOOM_CLOUD" ? "ZOOM_CLOUD" : "NONE"),
      recordingPlanned: String(formData.get("recordingPreference") || "NONE") !== "NONE",
      recordingConsentRequired: String(formData.get("recordingPreference") || "NONE") !== "NONE",
      lobbyEnabled: formData.get("lobbyEnabled") === "on",
      provider: "ZOOM",
      providerHostId: String(formData.get("providerHostId") ?? "")
    });
    revalidatePath(`/dashboard/meetings/${id}`);
  }

  async function requestConsent() {
    "use server";
    const workspace = await getCurrentWorkspace();
    if (!workspace) return;
    await requestRecordingConsent(workspace.id, id);
    revalidatePath(`/dashboard/meetings/${id}`);
  }
  async function recordingAction(formData: FormData) {
    "use server";
    const workspace = await getCurrentWorkspace();
    if (!workspace) return;
    const recordingId = String(formData.get("recordingId"));
    const action = String(formData.get("recordingAction"));
    if (action === "start") await startRecording(workspace.id, id, recordingId);
    if (action === "stop") await stopRecording(workspace.id, id, recordingId);
    if (action === "refresh") await reconcileRecording(workspace.id, id, recordingId);
    if (action === "transcribe") await processTranscriptionJob(workspace.id, id, recordingId);
    revalidatePath(`/dashboard/meetings/${id}`);
  }

  async function end() {
    "use server";
    const authorization = await authorizeMeetingJoin({ meetingId: id });
    await endMeeting(authorization);
    revalidatePath(`/dashboard/meetings/${id}`);
  }

  return <div className="space-y-6"><div><Link href="/dashboard/meetings" className="text-sm text-slate-500 hover:underline">← Back to meetings</Link><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold">{meeting.title}</h1><span className="rounded-full border px-3 py-1 text-xs font-medium">{label(meeting.status)}</span></div><p className="mt-2 text-slate-600 dark:text-slate-300">{meeting.description || "No description"}</p></div>
    {invitationUrl ? <Card className="border-blue-300 dark:border-blue-500/40"><CardHeader><CardTitle>Invitation created</CardTitle><CardDescription>This server-signed invitation link can be regenerated later from the active invitation.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3"><Input readOnly value={invitationUrl} className="min-w-0 flex-1" /><CopyInvitationButton value={invitationUrl} /></CardContent></Card> : null}
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2"><CardHeader><CardTitle>Meeting overview</CardTitle></CardHeader><CardContent className="grid gap-2 text-sm md:grid-cols-2"><p><span className="font-medium">Scheduled:</span> {meeting.scheduledAt?.toLocaleString() ?? "—"}</p><p><span className="font-medium">Started:</span> {meeting.startedAt?.toLocaleString() ?? "—"}</p><p><span className="font-medium">Ended:</span> {meeting.endedAt?.toLocaleString() ?? "—"}</p><p><span className="font-medium">Host:</span> {[meeting.host.firstName, meeting.host.lastName].filter(Boolean).join(" ") || meeting.host.email}</p><p><span className="font-medium">Lead:</span> {meeting.lead ? <Link className="underline" href={`/dashboard/leads/${meeting.lead.id}`}>{meeting.lead.name}</Link> : "—"}</p><p><span className="font-medium">Contact:</span> {meeting.contact ? <Link className="underline" href={`/dashboard/contacts/${meeting.contact.id}`}>{meeting.contact.firstName} {meeting.contact.lastName}</Link> : "—"}</p><p><span className="font-medium">Company:</span> {meeting.company ? <Link className="underline" href={`/dashboard/companies/${meeting.company.id}`}>{meeting.company.name}</Link> : "—"}</p><p><span className="font-medium">Opportunity:</span> {meeting.opportunity ? <Link className="underline" href={`/dashboard/opportunities/${meeting.opportunity.id}`}>{meeting.opportunity.name}</Link> : "—"}</p><p><span className="font-medium">CallSession:</span> {meeting.callSession ? <Link className="underline" href={`/dashboard/calls/${meeting.callSession.id}`}>{label(meeting.callSession.provider)} call</Link> : "—"}</p><p><span className="font-medium">Provider:</span> {meeting.provider === "NATIVE_LIVEKIT" ? "Legacy native" : label(meeting.provider)}</p><p><span className="font-medium">Provider status:</span> {meeting.providerStatus ?? "—"}</p><p><span className="font-medium">Provider waiting room:</span> {meeting.provider === "ZOOM" && meeting.lobbyEnabled ? "Zoom waiting room" : meeting.lobbyEnabled ? "Quantum Reach lobby" : "Off"}</p><p><span className="font-medium">Recording source:</span> {meeting.recordingPreference === "ZOOM_CLOUD" ? "Zoom cloud recording" : meeting.recordingPreference === "LOCAL_UPLOAD" ? "Upload local recording" : "Do not record"}</p><p><span className="font-medium">Recording consent required:</span> {meeting.recordingConsentRequired ? "Yes" : "No"}</p><p><span className="font-medium">Lobby enabled:</span> {meeting.lobbyEnabled ? "Yes" : "No"}</p><p><span className="font-medium">Consent prepared:</span> {meeting.recordingConsentPreparedAt?.toLocaleString() ?? "—"}</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Meeting actions</CardTitle><CardDescription>{meeting.provider === "ZOOM" ? "Start opens the protected Quantum Reach redirect in a new tab; raw Zoom start URLs never render in the page." : "Native meeting hosting has been retired. Create a Zoom meeting for future sessions."}</CardDescription></CardHeader><CardContent className="space-y-3">{meeting.status !== "ENDED" && meeting.status !== "CANCELED" ? (meeting.provider === "ZOOM" ? <Button asChild className="w-full"><Link href={`/api/meetings/${meeting.id}/start?workspaceId=${workspace.id}`} target="_blank" rel="noopener noreferrer">Start in Zoom</Link></Button> : <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-950 dark:text-amber-100">Native meeting hosting has been retired. Historical records remain available below.</p>) : null}{meeting.status !== "ENDED" ? <form action={end}><Button type="submit" variant="outline" className="w-full border-red-300 text-red-700 dark:text-red-300">End meeting</Button></form> : null}</CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>Recordings and transcripts</CardTitle><CardDescription>Provider-neutral recording and transcript workflow. Zoom cloud imports and direct local uploads both stay private in Cloudflare R2.</CardDescription></CardHeader><CardContent className="space-y-4">{meeting.recordingPreference === "ZOOM_CLOUD" ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-500/40 dark:bg-blue-950 dark:text-blue-100"><p>Zoom cloud recording requested. Cloud recording must be available and enabled for the selected Zoom host’s account.</p><form method="post" action={`/api/meetings/${id}/zoom-recordings/refresh?workspaceId=${workspace.id}`}><Button type="submit" className="mt-2" variant="outline">Check Zoom recording status</Button></form></div> : meeting.recordingPreference === "LOCAL_UPLOAD" ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950 dark:text-emerald-100"><p>Upload local recording. Choose Record to this computer in Zoom, then upload the MP4 or M4A file here after the meeting.</p><p className="mt-1 text-xs">Supported formats: MP4, M4A, MP3, WAV, WebM, MOV. Maximum upload size defaults to 5 GiB; large media may need background processing before transcription.</p></div> : <form action={requestConsent}><Button type="submit">Request recording consent</Button></form>}{recordings.map((recording) => { const consented = recording.consents.filter((consent) => consent.consentStatus === "CONSENTED").length; const pending = recording.consents.filter((consent) => consent.consentStatus === "PENDING").length; const declined = recording.consents.filter((consent) => consent.consentStatus === "DECLINED" || consent.consentStatus === "REVOKED").length; const labelStatus = recording.status === "CONSENT_REQUIRED" ? "Awaiting consent" : recording.status === "READY" ? "Ready to record" : recording.status === "PROCESSING" || recording.status === "STOPPING" ? "Finalizing" : label(recording.status); return <div key={recording.id} className="rounded-xl border p-4 text-sm dark:border-slate-800"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{labelStatus}{recording.status === "RECORDING" ? <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">Recording</span> : null}</p><p className="mt-1 text-slate-500">Consent: {consented} consented · {pending} pending · {declined} declined</p><p className="text-slate-500">Transcription: {recording.transcriptionStatus === "REVIEW_REQUIRED" ? "Transcript needs review" : recording.transcriptionStatus === "APPROVED" ? "Transcript approved" : label(recording.transcriptionStatus)}</p><p className="text-slate-500">Started {recording.startedAt?.toLocaleString() ?? "—"} · Completed {recording.completedAt?.toLocaleString() ?? "—"}</p>{recording.safeFailureMessage ? <p className="mt-2 rounded-lg bg-amber-50 p-2 text-amber-800 dark:bg-amber-950 dark:text-amber-100">{recording.safeFailureMessage}</p> : null}</div><form action={recordingAction} className="flex flex-wrap gap-2"><input type="hidden" name="recordingId" value={recording.id} />{recording.status === "READY" ? <Button name="recordingAction" value="start" type="submit">Start recording</Button> : null}{recording.status === "RECORDING" ? <Button name="recordingAction" value="stop" type="submit" variant="outline">Stop recording</Button> : null}{["STARTING", "STOPPING", "PROCESSING"].includes(recording.status) ? <Button name="recordingAction" value="refresh" type="submit" variant="outline">Refresh recording status</Button> : null}{recording.status === "AVAILABLE" ? <Button href={`/api/meetings/${id}/recordings/${recording.id}/download?workspaceId=${workspace.id}`} variant="outline">Protected download</Button> : null}{recording.status === "AVAILABLE" && ["QUEUED", "FAILED", "NOT_REQUESTED"].includes(recording.transcriptionStatus) ? <Button name="recordingAction" value="transcribe" type="submit" variant="outline">Retry transcription</Button> : null}{["REVIEW_REQUIRED", "APPROVED"].includes(recording.transcriptionStatus) ? <Button href={`/dashboard/meetings/${id}/recordings/${recording.id}/transcript`} variant="outline">Review transcript</Button> : null}{recording.callSessionId ? <Button href={`/dashboard/calls/${recording.callSessionId}`} variant="outline">Open CallSession</Button> : null}</form></div><div className="mt-3 grid gap-2 md:grid-cols-2">{recording.consents.map((consent) => <p key={consent.id} className="rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-900">{consent.displayName}: {label(consent.consentStatus)}</p>)}</div></div>; })}{recordings.length === 0 ? <p className="text-sm text-slate-500">No recording request has been created for this meeting.</p> : null}</CardContent></Card>
    <Card><CardHeader><CardTitle>Edit meeting</CardTitle><CardDescription>Linked CRM and CallSession records remain workspace-scoped.</CardDescription></CardHeader><form action={update} className="grid gap-4 md:grid-cols-2">
      <label className="grid gap-1 text-sm font-medium md:col-span-2">Title<Input name="title" required maxLength={160} defaultValue={meeting.title} /></label>
      <label className="grid gap-1 text-sm font-medium md:col-span-2">Description<Textarea name="description" maxLength={2000} defaultValue={meeting.description ?? ""} /></label>
      <label className="grid gap-1 text-sm font-medium">Scheduled time<Input name="scheduledAt" type="datetime-local" defaultValue={meeting.scheduledAt ? new Date(meeting.scheduledAt.getTime() - meeting.scheduledAt.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""} /></label>
      <label className="grid gap-1 text-sm font-medium">Lead<Select name="leadId" defaultValue={meeting.leadId}><option value="">No lead</option>{options.leads.map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Contact<Select name="contactId" defaultValue={meeting.contactId}><option value="">No contact</option>{options.contacts.map((record) => <option key={record.id} value={record.id}>{record.firstName} {record.lastName}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Company<Select name="companyId" defaultValue={meeting.companyId}><option value="">No company</option>{options.companies.map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Opportunity<Select name="opportunityId" defaultValue={meeting.opportunityId}><option value="">No opportunity</option>{options.opportunities.map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Call session<Select name="callSessionId" defaultValue={meeting.callSessionId}><option value="">No call session</option>{meeting.callSession ? <option value={meeting.callSession.id}>{label(meeting.callSession.provider)} · {meeting.callSession.callDate?.toLocaleString() ?? "No date"}</option> : null}{options.callSessions.filter((record) => record.id !== meeting.callSessionId).map((record) => <option key={record.id} value={record.id}>{label(record.provider)} · {record.callDate?.toLocaleString() ?? "No date"}</option>)}</Select></label>
      <fieldset className="grid gap-3 rounded-2xl border p-4 md:col-span-2 dark:border-slate-800"><legend className="px-1 text-sm font-semibold">Meeting settings</legend><label className="grid gap-1 text-sm"><span className="font-medium">Recording</span><select name="recordingPreference" defaultValue={meeting.recordingPreference} className="rounded-md border bg-background px-3 py-2"><option value="NONE">Do not record</option><option value="ZOOM_CLOUD">Record to Zoom cloud</option><option value="LOCAL_UPLOAD">Record locally and upload afterward</option></select><span className="text-slate-500">Cloud recording must be available and enabled for the selected Zoom host’s account. Choose Record to this computer in Zoom for local recording.</span></label><label className="flex gap-3 text-sm"><input type="checkbox" name="recordingConsentRequired" checked readOnly /> <span><span className="font-medium">Require recording consent before entry</span><span className="block text-slate-500">Participants must consent before entering a recorded meeting.</span></span></label><label className="flex gap-3 text-sm"><input type="checkbox" name="lobbyEnabled" defaultChecked={meeting.lobbyEnabled} /> <span><span className="font-medium">Zoom waiting room enabled</span><span className="block text-slate-500">Guests wait in Zoom until admitted by the host.</span></span></label></fieldset>
      <Button type="submit" className="md:col-span-2 md:w-fit">Save meeting</Button>
    </form></Card>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Guest invitations</CardTitle><CardDescription>{meeting.provider === "ZOOM" ? "This secure Quantum Reach invitation validates guest access and recording consent before opening the Zoom meeting." : "Legacy native invitations are retained for history; native runtime is retired."}</CardDescription></CardHeader><CardContent className="space-y-4"><form action={createInvitation} className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-sm">Guest display name<Input name="displayName" maxLength={80} /></label><label className="grid gap-1 text-sm">Guest email<Input name="email" type="email" maxLength={254} /></label><label className="grid gap-1 text-sm">Role<Select name="role" defaultValue="GUEST"><option value="GUEST">Guest</option><option value="PARTICIPANT">Participant</option></Select></label><label className="grid gap-1 text-sm">Expires at<Input name="expiresAt" type="datetime-local" defaultValue={new Date(((meeting.scheduledAt ?? new Date()).getTime() + 86400000) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} max={new Date(((meeting.scheduledAt ?? new Date()).getTime() + 86400000) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} /></label><Button type="submit" className="md:w-fit">Create invitation</Button></form>{meeting.invitations.map((invitation) => { const status = invitation.revokedAt ? "REVOKED" : invitation.expiresAt && invitation.expiresAt <= new Date() ? "EXPIRED" : meeting.scheduledAt && meeting.scheduledAt > new Date() ? "SCHEDULED" : "ACTIVE"; return <div key={invitation.id} className="rounded-xl border p-3 text-sm dark:border-slate-800"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{invitation.displayName || "Guest invitation"}</p><p className="text-xs text-slate-500">{invitation.email || "No email"} · {label(invitation.role)} · {status}</p><p className="text-xs text-slate-500">Expires {invitation.expiresAt?.toLocaleString() ?? "—"} · Meeting {meeting.scheduledAt?.toLocaleString() ?? "unscheduled"}</p><p className="text-xs text-slate-500">Created {invitation.createdAt.toLocaleString()} · Updated {invitation.updatedAt.toLocaleString()}</p></div><div className="flex flex-wrap gap-2">{status === "ACTIVE" || status === "SCHEDULED" ? <><CopyManagedInvitationButton meetingId={meeting.id} invitationId={invitation.id} label={meeting.provider === "ZOOM" ? "Copy Zoom invitation link" : "Copy legacy invitation link"} /><Button href={`/dashboard/meetings/${meeting.id}/invitations/${invitation.id}/edit`} variant="outline">Edit invitation</Button><form action={revoke}><input type="hidden" name="invitationId" value={invitation.id} /><Button type="submit" variant="ghost">Revoke</Button></form></> : null}</div></div></div>; })}{meeting.invitations.length === 0 ? <p className="text-sm text-slate-500">No guest invitations.</p> : null}</CardContent></Card>
      <Card><CardHeader><CardTitle>Participant history</CardTitle><CardDescription>These records support workflow history; they do not drive the live room grid.</CardDescription></CardHeader><CardContent className="space-y-2">{meeting.participants.map((participant) => <div key={participant.id} className="rounded-xl border p-3 text-sm dark:border-slate-800"><div className="flex justify-between gap-3"><span className="font-medium">{participant.displayName}</span><span>{label(participant.role)}</span></div><p className="mt-1 text-xs text-slate-500">Joined {participant.joinedAt?.toLocaleString() ?? "—"} · Left {participant.leftAt?.toLocaleString() ?? "—"}</p></div>)}{meeting.participants.length === 0 ? <p className="text-sm text-slate-500">No participants have joined.</p> : null}</CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Recent meeting activity</CardTitle><CardDescription>Safe lifecycle events only; credentials and invitation tokens are never recorded.</CardDescription></CardHeader><CardContent className="space-y-2">{meeting.events.map((event) => <div key={event.id} className="flex flex-wrap justify-between gap-2 rounded-xl border p-3 text-sm dark:border-slate-800"><span>{label(event.type)}{event.participant ? ` · ${event.participant.displayName}` : ""}</span><span className="text-slate-500">{event.occurredAt.toLocaleString()}</span></div>)}{meeting.events.length === 0 ? <p className="text-sm text-slate-500">No meeting activity yet.</p> : null}</CardContent></Card>
  </div>;
}
