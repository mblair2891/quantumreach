import Link from "next/link";
import { notFound } from "next/navigation";
import { OperatorBootstrapForm } from "@/components/auth/operator-bootstrap-form";
import {
  getOperatorBootstrapGate,
  isOperatorBootstrapEnvironment,
} from "@/lib/auth/operator-bootstrap";

export const dynamic = "force-dynamic";

export default async function OperatorBootstrapPage() {
  // Fail closed in production — do not advertise this route.
  if (!isOperatorBootstrapEnvironment()) {
    notFound();
  }

  const gate = await getOperatorBootstrapGate();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-700">Preview only</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Create platform operator</h1>
        <p className="mt-2 text-sm text-slate-600">
          Browser bootstrap for the first operator account on Preview or local development. The email
          must already appear in <code className="rounded bg-slate-100 px-1">ADMIN_EMAILS</code>.
          This is not public self-service sign-up.
        </p>

        {!gate.available ? (
          <div className="mt-6 space-y-4">
            <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {gate.blockedReason ?? "Operator bootstrap is not available."}
            </p>
            <Link
              className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700"
              href="/sign-in"
            >
              Go to sign in
            </Link>
          </div>
        ) : (
          <>
            {gate.requiresBootstrapSecret ? (
              <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                An allowlisted operator already exists. Enter the environment{" "}
                <code className="rounded bg-slate-100 px-1">BOOTSTRAP_SECRET</code> to create another.
              </p>
            ) : (
              <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                No operator account found yet. You can create the first one here.
              </p>
            )}
            <div className="mt-6">
              <OperatorBootstrapForm requiresBootstrapSecret={gate.requiresBootstrapSecret} />
            </div>
            <p className="mt-6 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link className="font-semibold text-indigo-700 underline" href="/sign-in">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
