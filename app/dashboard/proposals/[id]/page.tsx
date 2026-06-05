import { ProposalDetailPage } from "@/components/dashboard/detail-page";
export default function Page({ params }: { params: { id: string } }) { return <ProposalDetailPage id={params.id} />; }
