import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspaceAdmin } from "@/lib/auth/rbac";
import { getDomainRegistrantProfile, upsertDomainRegistrantProfile, confirmDomainRegistrantProfile } from "@/lib/managed-domains/purchase";
import { REGISTRANT_ATTESTATION, REGISTRANT_COPY, validateRegistrantContact } from "@/lib/managed-domains/registrant";

async function saveRegistrantProfile(formData: FormData) {
  "use server";
  const { workspace } = await requireWorkspaceAdmin(String(formData.get("workspaceId") || undefined));
  await upsertDomainRegistrantProfile({
    workspaceId: workspace.id,
    registrantType: String(formData.get("registrantType") || "ORGANIZATION"),
    legalFirstName: String(formData.get("legalFirstName") || ""),
    legalLastName: String(formData.get("legalLastName") || ""),
    organizationName: String(formData.get("organizationName") || "") || null,
    address1: String(formData.get("address1") || ""),
    address2: String(formData.get("address2") || "") || null,
    city: String(formData.get("city") || ""),
    stateProvince: String(formData.get("stateProvince") || ""),
    postalCode: String(formData.get("postalCode") || ""),
    countryCode: String(formData.get("countryCode") || ""),
    phone: String(formData.get("phone") || ""),
    email: String(formData.get("email") || ""),
  });
  revalidatePath("/dashboard/settings/domain-registrant");
}

async function confirmRegistrantProfile(formData: FormData) {
  "use server";
  const { user, workspace } = await requireWorkspaceAdmin(String(formData.get("workspaceId") || undefined));
  await confirmDomainRegistrantProfile(workspace.id, user.id);
  revalidatePath("/dashboard/settings/domain-registrant");
}

const fields = [
  ["legalFirstName", "Legal first name"], ["legalLastName", "Legal last name"], ["organizationName", "Organization name"], ["address1", "Address line 1"], ["address2", "Address line 2"], ["city", "City"], ["stateProvince", "State / province"], ["postalCode", "Postal code"], ["countryCode", "Country code"], ["phone", "Phone"], ["email", "Email"],
] as const;

export default async function DomainRegistrantSettingsPage() {
  const { workspace } = await requireWorkspaceAdmin();
  const profile = await getDomainRegistrantProfile(workspace.id);
  const completeness = validateRegistrantContact(profile);
  return <div className="space-y-6"><header><p className="text-sm font-medium text-slate-500">Workspace settings</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Domain Registrant Profile</h1><p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">{REGISTRANT_COPY} This profile is used when {workspace.name} requests WORKSPACE_OWNED domain registrations.</p></header><Card><CardHeader><CardTitle>Ownership model</CardTitle><CardDescription>Customer/workspace is normally the registrant for WORKSPACE_OWNED domains. Quantum Reach is the reseller/service manager for DNS, SES, warmup, renewal, and billing. Quantum Reach-owned domains are a separate ownership mode.</CardDescription></CardHeader></Card><Card><CardHeader><CardTitle>Profile completeness</CardTitle><CardDescription>{completeness.complete ? "Complete" : `Missing: ${completeness.missing.join(", ")}`}</CardDescription></CardHeader><CardContent className="text-sm"><p>Confirmed: {profile?.confirmedAt ? profile.confirmedAt.toLocaleString() : "Not confirmed"}</p></CardContent></Card><form action={saveRegistrantProfile} className="grid gap-4 rounded-2xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-950 md:grid-cols-2"><input type="hidden" name="workspaceId" value={workspace.id} /><label className="grid gap-1 text-sm"><span className="font-medium">Registrant type</span><select name="registrantType" defaultValue={profile?.registrantType ?? "ORGANIZATION"} className="rounded-md border bg-background px-3 py-2"><option value="ORGANIZATION">Organization</option><option value="INDIVIDUAL">Individual</option></select></label>{fields.map(([name, label]) => <label key={name} className="grid gap-1 text-sm"><span className="font-medium">{label}</span><input name={name} defaultValue={String(profile?.[name] ?? "")} className="rounded-md border bg-background px-3 py-2" /></label>)}<div className="md:col-span-2"><Button type="submit">Save registrant profile</Button></div></form><form action={confirmRegistrantProfile} className="rounded-2xl border bg-blue-50 p-4 text-sm text-blue-950"><input type="hidden" name="workspaceId" value={workspace.id} /><p>{REGISTRANT_ATTESTATION}</p><Button type="submit" className="mt-3" disabled={!completeness.complete}>Confirm accuracy</Button></form></div>;
}
