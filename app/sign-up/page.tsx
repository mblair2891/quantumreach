import Link from "next/link";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { isPublicSignUpEnabled } from "@/lib/auth/constants";

function safeNext(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app";
  return value;
}

export default function SignUpPage({ searchParams }: { searchParams?: { next?: string; redirect_url?: string } }) {
  const nextPath = safeNext(searchParams?.next ?? searchParams?.redirect_url);
  const open = isPublicSignUpEnabled();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-950">{open ? "Create your account" : "Registration closed"}</h1>
        {open ? (
          <>
            <p className="mt-2 text-sm text-slate-600">Create an email and password for Quantum Reach.</p>
            <div className="mt-6">
              <SignUpForm nextPath={nextPath} />
            </div>
            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account?{" "}
              <Link className="font-semibold text-indigo-700 underline" href={`/sign-in?next=${encodeURIComponent(nextPath)}`}>
                Sign in
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Public self-service sign-up is disabled. After you purchase Quantum Reach you will receive an email with a
              secure setup link to create your password.
            </p>
            <Link
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700"
              href="/sign-in"
            >
              Go to sign in
            </Link>
            <p className="mt-4 text-center text-sm text-slate-500">
              Operators: enable public sign-up only via controlled configuration when required.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
