import { CallDetailPage } from "@/components/dashboard/call-pages";
export default function Page({ params }: { params: { id: string } }) { return <CallDetailPage id={params.id} />; }
