import Link from "next/link";
import { FunnelShell } from "@/components/funnel/shell";
import { getActiveSetupTokenByRaw } from "@/lib/auth/account-setup";
import { AccountSetupForm } from "@/components/auth/account-setup-form";
import { ACCOUNT_SETUP_TOKEN_TTL_HOURS } from "@/lib/auth/constants";

export default async function AccountSetupPage({
  searchParams,
}: {
  searchParams?: { token?: string; error?: string };
}) {
  const rawToken = searchParams?.token?.trim() ?? "";
  if (!rawToken) {
    return (
      <FunnelShell>
        <main className="mx-auto max-w-lg px-5 py-16">
          <h1 className="text-3xl font-semibold">Setup link required</h1>
          <p className="mt-3 text-slate-600">Open the secure link from your order confirmation or email.</p>
          <Link className="funnel-primary mt-8 inline-flex" href="/sign-in">
            Sign in
          </Link>
        </main>
      </FunnelShell>
    );
  }

  const resolved = await getActiveSetupTokenByRaw(rawToken);
  if (!resolved.ok) {
    const copy: Record<string, string> = {
      INVALID: "This setup link is invalid.",
      USED: "This setup link was already used. Sign in with your password.",
      EXPIRED: `This setup link expired (links last ${ACCOUNT_SETUP_TOKEN_TTL_HOURS} hours). Contact support for a new invite.`,
      UNPAID: "Payment is not verified for this order yet.",
      ALREADY_CLAIMED: "This order already has an account. Sign in instead.",
    };
    return (
      <FunnelShell>
        <main className="mx-auto max-w-lg px-5 py-16">
          <h1 className="text-3xl font-semibold">Cannot open setup</h1>
          <p className="mt-3 text-slate-600">{copy[resolved.reason] ?? "This setup link cannot be used."}</p>
          <Link className="funnel-primary mt-8 inline-flex" href="/sign-in">
            Go to sign in
          </Link>
        </main>
      </FunnelShell>
    );
  }

  const order = resolved.record.order;
  return (
    <FunnelShell>
      <main className="mx-auto max-w-lg px-5 py-16">
        <p className="funnel-eyebrow">Account setup</p>
        <h1 className="funnel-title mt-3 text-3xl font-semibold">Create your password</h1>
        <p className="mt-3 text-slate-600">
          Complete setup for <strong>{resolved.record.email}</strong>
          {order.businessName ? (
            <>
              {" "}
              ({order.businessName})
            </>
          ) : null}
          . This activates your Quantum Reach workspace after payment.
        </p>
        {searchParams?.error ? (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {searchParams.error}
          </p>
        ) : null}
        <div className="mt-8">
          <AccountSetupForm
            token={rawToken}
            email={resolved.record.email}
            defaultFirstName={order.purchaserFirstName ?? ""}
            defaultLastName={order.purchaserLastName ?? ""}
          />
        </div>
      </main>
    </FunnelShell>
  );
}
