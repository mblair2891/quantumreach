import { AnalysisDetailPage } from "@/components/dashboard/detail-page";
export default function Page({ params }: { params: { id: string } }) { return <AnalysisDetailPage id={params.id} />; }
