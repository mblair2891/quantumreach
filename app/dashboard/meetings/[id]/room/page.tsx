import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentWorkspace } from "@/lib/workspaces/service";
import { getMeetingDetail } from "@/lib/meetings/service";
import { audit } from "@/lib/audit/service";
import { requireUserProfile } from "@/lib/auth/rbac";

export default async function Page({ params }: { params: { id: string } }) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;
  const [meeting, user] = await Promise.all([getMeetingDetail(workspace.id, params.id), requireUserProfile()]);
  await audit(workspace.id, "legacy_native_runtime_blocked", "MeetingRoom", meeting.id, user.id, { provider: meeting.provider });
  return <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center p-6"><Card><CardHeader><CardTitle>Native meeting runtime retired</CardTitle><CardDescription>{meeting.title}</CardDescription></CardHeader><CardContent className="space-y-4"><p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-950 dark:text-amber-100">Native meeting hosting has been retired. Historical metadata, recordings, transcripts, participant history, and CallSession links remain available on the meeting detail page.</p><Link className="text-sm font-medium underline" href={`/dashboard/meetings/${meeting.id}`}>Return to meeting history</Link></CardContent></Card></main>;
}
