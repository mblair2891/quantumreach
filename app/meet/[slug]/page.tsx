import { MeetingClient } from "@/components/meetings/meeting-client";
import { getPublicMeeting } from "@/lib/meetings/service";

export default async function Page({ params, searchParams }: { params: { slug: string }; searchParams: { token?: string } }) {
  const { meeting, accessError } = await getPublicMeeting(params.slug, searchParams.token);
  if (!meeting || accessError) return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-50"><section className="max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center"><p className="text-sm font-medium text-blue-300">Quantum Reach Meetings</p><h1 className="mt-3 text-2xl font-semibold">{meeting?.title ?? "Meeting unavailable"}</h1>{meeting?.scheduledAt ? <p className="mt-2 text-sm text-slate-400">{meeting.scheduledAt.toLocaleString()}</p> : null}<p className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">{accessError}</p></section></main>;
  return <MeetingClient meeting={{ id: meeting.id, title: meeting.title, description: meeting.description, scheduledAt: meeting.scheduledAt?.toISOString() }} invitationToken={searchParams.token} />;
}
