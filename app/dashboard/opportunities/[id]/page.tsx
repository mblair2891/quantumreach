import { DetailPage } from "@/components/dashboard/detail-page";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <DetailPage type="opportunities" id={id} />; }
