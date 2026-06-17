import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getPublicMeeting, getZoomJoinUrl } from "@/lib/meetings/service";

export default async function Page({ params, searchParams }: { params: { slug: string }; searchParams: { token?: string; invite?: string } }) {
  const invitationToken = searchParams.invite ?? searchParams.token;
  const { meeting, accessError } = await getPublicMeeting(params.slug, invitationToken);
  if (!meeting || accessError) return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-50"><section className="max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center"><p className="text-sm font-medium text-blue-300">Quantum Reach Meetings</p><h1 className="mt-3 text-2xl font-semibold">{meeting?.title ?? "Meeting unavailable"}</h1>{meeting?.scheduledAt ? <p className="mt-2 text-sm text-slate-400">{meeting.scheduledAt.toLocaleString()}</p> : null}<p className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">{accessError}</p></section></main>;
  if (meeting.provider === "NATIVE_LIVEKIT") return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-50"><section className="max-w-lg rounded-3xl border border-amber-500/40 bg-slate-900 p-8 text-center"><p className="text-sm font-medium text-amber-300">Legacy native meeting</p><h1 className="mt-3 text-2xl font-semibold">{meeting.title}</h1><p className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">Native meeting hosting has been retired. Create a Zoom meeting for future sessions.</p></section></main>;
  async function continueToZoom(formData: FormData) {
    "use server";
    const url = await getZoomJoinUrl(meeting!.id, invitationToken, String(formData.get("displayName") ?? ""), formData.get("recordingConsent") === "on");
    redirect(url);
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-50"><form action={continueToZoom} className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-8"><p className="text-sm font-medium text-blue-300">Hosted with Zoom</p><h1 className="mt-3 text-2xl font-semibold">{meeting.title}</h1>{meeting.scheduledAt ? <p className="mt-2 text-sm text-slate-400">{meeting.scheduledAt.toLocaleString()}</p> : null}<label className="mt-6 grid gap-2 text-sm">Invitation display name<input name="displayName" defaultValue={meeting.invitationDisplayName ?? ""} readOnly className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" /></label>{meeting.recordingConsentRequired ? <label className="mt-4 flex gap-3 rounded-xl border border-blue-500/40 bg-blue-500/10 p-3 text-sm"><input required type="checkbox" name="recordingConsent" /> <span>I consent to this Zoom meeting being recorded and reviewed in Quantum Reach.</span></label> : null}<Button type="submit" className="mt-6 w-full">Continue to Zoom</Button><p className="mt-4 text-xs text-slate-400">This secure Quantum Reach invitation validates guest access and recording consent before opening the Zoom meeting.</p></form></main>;
}
