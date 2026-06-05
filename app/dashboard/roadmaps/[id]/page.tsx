import { RoadmapDetailPage } from "@/components/dashboard/detail-page";
export default function Page({ params }: { params: { id: string } }) { return <RoadmapDetailPage id={params.id} />; }
