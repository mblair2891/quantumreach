import { PlatformShell } from "@/components/platform/shell";
import { requireOperatorAccess } from "@/lib/admin/operator";
export default async function Layout({children}:{children:React.ReactNode}){await requireOperatorAccess(); return <PlatformShell>{children}</PlatformShell>}
