import { CrmDetailPage } from "@/components/dashboard/crm-pages";
export default function Page({ params }: { params: { id: string } }) { return <CrmDetailPage module="companies" id={params.id} />; }
