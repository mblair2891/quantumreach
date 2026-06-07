import { OutreachDetailPage } from "@/components/dashboard/outreach-pages";

export default function Page({ params }: { params: { id: string } }) {
  return <OutreachDetailPage id={params.id} />;
}
