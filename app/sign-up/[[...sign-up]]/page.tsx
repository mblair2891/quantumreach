import { SignUp } from "@clerk/nextjs";
import { hasClerkPublishableKey } from "@/lib/auth/clerk-build";
export default function Page() { return <main className="flex min-h-screen items-center justify-center bg-slate-50">{hasClerkPublishableKey ? <SignUp /> : <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">Clerk is not configured in this build environment.</div>}</main>; }
