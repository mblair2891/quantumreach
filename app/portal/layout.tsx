import { ClientPortalShell } from "@/components/portal/shell";
import { requireClientPortalAccess } from "@/lib/saas/access";
export default async function Layout({children}:{children:React.ReactNode}){await requireClientPortalAccess(); return <ClientPortalShell>{children}</ClientPortalShell>}
