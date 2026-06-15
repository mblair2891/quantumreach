import { MeetingDetailPage } from "@/components/dashboard/meeting-pages";

export default function Page({ params, searchParams }: { params: { id: string }; searchParams: { invitation?: string } }) {
  return <MeetingDetailPage id={params.id} invitationToken={searchParams.invitation} />;
}
