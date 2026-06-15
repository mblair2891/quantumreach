import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentWorkspace } from "@/lib/workspaces/service";
import { getMeetingDetail, updateMeetingInvitation } from "@/lib/meetings/service";

function localValue(date?: Date | null) {
  if (!date) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default async function Page({ params }: { params: { id: string; invitationId: string } }) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;
  const meeting = await getMeetingDetail(workspace.id, params.id);
  const invitation = meeting.invitations.find((item) => item.id === params.invitationId);
  if (!invitation) return null;
  const maxExpiry = new Date(((meeting.scheduledAt ?? new Date()).getTime() + 86400000));
  async function save(formData: FormData) {
    "use server";
    const workspace = await getCurrentWorkspace();
    if (!workspace) return;
    await updateMeetingInvitation(workspace.id, params.id, params.invitationId, {
      displayName: String(formData.get("displayName") ?? ""),
      email: String(formData.get("email") ?? ""),
      role: String(formData.get("role") ?? ""),
      expiresAt: String(formData.get("expiresAt") ?? "")
    });
    redirect(`/dashboard/meetings/${params.id}?updatedInvitation=1`);
  }
  return <div className="space-y-6"><Link href={`/dashboard/meetings/${params.id}`} className="text-sm text-slate-500 hover:underline">← Back to meeting</Link><Card><CardHeader><CardTitle>Edit invite</CardTitle><CardDescription>Only guest details, role, and expiration can be changed. Revoked invitations cannot be reactivated.</CardDescription></CardHeader><CardContent><form action={save} className="grid gap-4 md:grid-cols-2"><label className="grid gap-1 text-sm">Display name<Input name="displayName" defaultValue={invitation.displayName ?? ""} maxLength={80} /></label><label className="grid gap-1 text-sm">Email<Input name="email" type="email" defaultValue={invitation.email ?? ""} maxLength={254} /></label><label className="grid gap-1 text-sm">Role<select name="role" defaultValue={invitation.role} className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm dark:bg-slate-950"><option value="GUEST">Guest</option><option value="PARTICIPANT">Participant</option></select></label><label className="grid gap-1 text-sm">Expires at<Input name="expiresAt" required type="datetime-local" defaultValue={localValue(invitation.expiresAt)} max={localValue(maxExpiry)} /></label><Button type="submit" className="md:w-fit">Save invite</Button></form></CardContent></Card></div>;
}
