import { MeetingDetailPage } from "@/components/dashboard/meeting-pages";

export default function Page({ params, searchParams }: { params: { id: string }; searchParams: { invitationUrl?: string } }) {
  return <MeetingDetailPage id={params.id} invitationUrl={searchParams.invitationUrl} />;
}
