import { DiagnosticDetailPage } from "@/components/dashboard/diagnostic-pages";
export default function Page({ params }: { params: { id: string } }) { return <DiagnosticDetailPage id={params.id} />; }
