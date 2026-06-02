import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { onboardWorkspace } from "@/lib/workspaces/service";

async function createWorkspace(formData: FormData) { "use server"; await onboardWorkspace({ name: String(formData.get("name") ?? "") }); redirect("/dashboard"); }
export default function OnboardingPage() { return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><form action={createWorkspace} className="w-full max-w-xl space-y-6 rounded-3xl border bg-white p-8 shadow-xl"><div><p className="text-sm font-medium text-slate-500">Workspace onboarding</p><h1 className="mt-2 text-3xl font-semibold">Create your operating workspace</h1><p className="mt-2 text-slate-600">All CRM, diagnostic, AI, report, proposal, project, note, task, and audit records are scoped to a workspace.</p></div><Input name="name" placeholder="Acme Advisory" required minLength={2} /><Button type="submit" className="w-full">Create workspace</Button></form></main>; }
