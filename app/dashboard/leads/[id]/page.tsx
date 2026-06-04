import { CrmDetailPage } from "@/components/dashboard/crm-pages";
export default function Page({ params }: { params: { id: string } }) { return <CrmDetailPage module="leads" id={params.id} />; }
