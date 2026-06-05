import { ReportDetailPage } from "@/components/dashboard/detail-page";
export default function Page({ params }: { params: { id: string } }) { return <ReportDetailPage id={params.id} />; }
