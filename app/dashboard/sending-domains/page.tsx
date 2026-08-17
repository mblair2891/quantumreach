import { redirect } from "next/navigation";

/** Legacy route. BYO add/verify lives at /dashboard/sending/domains. */
export default function WorkspaceSendingDomainsPage() {
  redirect("/dashboard/sending/domains");
}
