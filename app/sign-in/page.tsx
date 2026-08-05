import Link from "next/link";
import { SignInForm } from "@/components/auth/sign-in-form";
import { isPublicSignUpEnabled } from "@/lib/auth/constants";

function safeNext(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app";
  return value;
}

export default function SignInPage({ searchParams }: { searchParams?: { next?: string; redirect_url?: string } }) {
  const nextPath = safeNext(searchParams?.next ?? searchParams?.redirect_url);
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-950">Sign in to Quantum Reach</h1>
        <p className="mt-2 text-sm text-slate-600">Use your email or username, plus password.</p>
        <div className="mt-6">
          <SignInForm nextPath={nextPath} />
        </div>
        {isPublicSignUpEnabled() ? (
          <p className="mt-6 text-center text-sm text-slate-600">
            Need an account?{" "}
            <Link className="font-semibold text-indigo-700 underline" href={`/sign-up?next=${encodeURIComponent(nextPath)}`}>
              Create one
            </Link>
          </p>
        ) : (
          <p className="mt-6 text-center text-sm text-slate-500">
            Public registration is closed. New subscribers receive a setup link after purchase.
          </p>
        )}
      </div>
    </main>
  );
}
