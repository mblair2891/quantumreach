import { DetailPage } from "@/components/dashboard/detail-page";
export default function Page({ params }: { params: { id: string } }) { const { id } = params; return <DetailPage type="diagnostics" id={id} />; }
