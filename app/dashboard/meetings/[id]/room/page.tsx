import { MeetingClient } from "@/components/meetings/meeting-client";
import { getCurrentWorkspace } from "@/lib/workspaces/service";
import { getMeetingDetail } from "@/lib/meetings/service";
import { requireUserProfile } from "@/lib/auth/rbac";

export default async function Page({ params }: { params: { id: string } }) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;
  const [meeting, user] = await Promise.all([getMeetingDetail(workspace.id, params.id), requireUserProfile()]);
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  return <MeetingClient
    meeting={{ id: meeting.id, title: meeting.title, description: meeting.description, scheduledAt: meeting.scheduledAt?.toISOString() }}
    defaultDisplayName={displayName}
    dashboardReturnUrl={`/dashboard/meetings/${meeting.id}`}
  />;
}
