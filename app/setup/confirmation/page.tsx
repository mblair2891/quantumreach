import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getOptionalUserProfile } from "@/lib/auth/rbac";
import { catalogPrice, getDraftSession, loadValidatedDraft, money } from "@/lib/customer-journey/acquisition-draft";
import { buildAcquisitionChargeSummary } from "@/lib/commercial/charge-lines";
import { applyCouponToSummary, getAppliedCoupon, type CouponCalculation } from "@/lib/commercial/coupons";
import {
  applyCouponAction,
  removeCouponAction,
  resendAccountSetupEmailAction,
  submitGuestCheckoutAction,
} from "./actions";
import { FunnelProgress } from "@/components/funnel/progress";
import { FunnelShell } from "@/components/funnel/shell";
import { StripeCheckoutButton } from "@/components/funnel/stripe-checkout-button";
import { getBillingConfig } from "@/lib/billing/config";
import {
  confirmationSetupInvitePresentation,
  issueAccountSetupToken,
  parseAccountSetupEmailDelivery,
} from "@/lib/auth/account-setup";
import { ACCOUNT_SETUP_TOKEN_TTL_HOURS } from "@/lib/auth/constants";
import { COMMON_TIMEZONES, DEFAULT_CHECKOUT_TIMEZONE } from "@/lib/customer-journey/timezones";
import { getCapturedReferralCodeForSession } from "@/lib/affiliates/service";
import type { CustomerOrder } from "@prisma/client";

export default async function Confirmation({
  searchParams,
}: {
  searchParams: {
    submitted?: string;
    couponMessage?: string;
    testPayment?: string;
    orderId?: string;
    setupToken?: string;
    emailDelivery?: string;
    checkoutError?: string;
    checkout?: string;
  };
}) {
  const signedInUser = await getOptionalUserProfile();
  const checkoutState = searchParams.checkout;
  const paymentReturn =
    Boolean(searchParams.orderId) ||
    searchParams.submitted === "1" ||
    checkoutState === "success" ||
    checkoutState === "cancelled";

  let selection: Awaited<ReturnType<typeof loadValidatedDraft>> | null = null;
  try {
    selection = await loadValidatedDraft();
  } catch {
    selection = null;
  }

  // Stripe success/cancel (and submitted resume) must work even if the acquisition draft expired.
  if (paymentReturn) {
    const order = await resolveConfirmationOrder({
      orderId: searchParams.orderId,
      signedInUserId: signedInUser?.id,
      draftSessionId: selection?.session.id,
    });
    if (order) {
      return renderOrderPaymentState({ order, searchParams, checkoutState });
    }
  }

  if (!selection) {
    redirect("/start?selection=expired");
  }

  const setupPrice = catalogPrice(selection.setup);
  const setupProductKey = selection.setup.key;
  if (!setupPrice.configured || (setupProductKey !== "STANDARD_SETUP" && setupProductKey !== "PRIORITY_SETUP")) {
    redirect("/setup/priority");
  }
  const baseCharges = buildAcquisitionChargeSummary(selection.infrastructure.key, {
    productKey: setupProductKey,
    displayName: selection.setup.name,
    amountCents: setupPrice.oneTimeCents,
  });
  const applied = await getAppliedCoupon(selection.session.id);
  let charges = baseCharges;
  let couponCalculation: CouponCalculation | null = null;
  let couponMessage = searchParams.couponMessage;
  if (applied) {
    try {
      couponCalculation = applyCouponToSummary(baseCharges, applied.coupon);
      charges = couponCalculation;
    } catch (error) {
      couponMessage = error instanceof Error ? error.message : "This code no longer applies to the selected order.";
    }
  }

  const resume = selection.session.anonymousId ?? selection.session.id;
  const plan = charges.plan;
  const billingConfigured = getBillingConfig().configured;
  // Prefill from /r/{code} capture on this acquisition session (coupons are separate).
  const prefilledReferralCode = (await getCapturedReferralCodeForSession(selection.session.id)) ?? "";

  return (
    <FunnelShell>
      <main className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
        <FunnelProgress current={4} />
        <p className="text-center funnel-eyebrow">Step 4 · Review & checkout</p>
        <h1 className="text-center funnel-title mt-3 text-4xl font-semibold">Review your Quantum Reach order.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-slate-700">
          Pay first, then create your password from a secure setup link. Nothing is provisioned until payment is
          verified and your account is created.
        </p>

        {searchParams.checkoutError ? (
          <p role="alert" className="mx-auto mt-6 max-w-2xl rounded-xl bg-red-50 p-4 text-sm text-red-800">
            {searchParams.checkoutError}
          </p>
        ) : null}

        <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">{plan.name} package</h2>
              <p className="mt-2 text-slate-700">Quantum Reach software included</p>
            </div>
            <Link className="text-sm font-semibold text-indigo-700 underline" href="/start">
              Edit package
            </Link>
          </div>
          <ul className="mt-5 grid gap-2 text-sm text-slate-800 sm:grid-cols-2">
            <li>{plan.domains.toLocaleString()} managed domains</li>
            <li>{plan.mailboxes.toLocaleString()} mailboxes</li>
            <li>{plan.contacts.toLocaleString()} contacts</li>
            <li>{plan.teamUsers.toLocaleString()} team users</li>
            <li>{plan.monthlySends.toLocaleString()} monthly sends</li>
            <li>
              {money(plan.monthlyCents)}/month
            </li>
          </ul>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-950">Coupon</h2>
          {applied ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-950">
                  {applied.coupon.displayName} · {applied.normalizedCodeSnapshot}
                </p>
                <p className="text-sm font-medium text-emerald-800">
                  You save {money(couponCalculation?.totalCouponSavingsCents ?? 0)} today.
                </p>
              </div>
              <form action={removeCouponAction}>
                <button className="text-sm font-semibold text-red-700 underline">Remove coupon</button>
              </form>
            </div>
          ) : null}
          <form action={applyCouponAction} className="mt-4 flex flex-wrap gap-3">
            <input
              name="code"
              required
              aria-label="Coupon code"
              placeholder="Coupon code"
              className="qr-field-sm min-w-[12rem] flex-1"
            />
            <input type="hidden" name="replace" value={applied ? "true" : "false"} />
            <button className="rounded-lg bg-slate-950 px-4 py-2 font-medium text-white">
              {applied ? "Replace coupon" : "Apply coupon"}
            </button>
          </form>
          {couponMessage ? (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {couponMessage}
            </p>
          ) : null}
        </section>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <Row label="Monthly package fee" value={money(plan.monthlyCents)} />
          <Row label="One-time implementation fee" value={money(plan.setupCents)} />
          <Row label="Setup priority" value={selection.setup.name} edit="/setup/priority" />
          <Row
            label={selection.setup.key === "STANDARD_SETUP" ? "Standard" : "Head of the line"}
            value={setupPrice.oneTimeCents === 0 ? "Included" : money(setupPrice.oneTimeCents)}
          />
          <Row label="Today’s total" value={money(charges.todayTotalCents)} emphasize />
          <Row label="Recurring monthly fee" value={`${money(charges.recurringMonthlyCents)}/month`} />
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-950">Purchaser details</h2>
          <p className="mt-2 text-sm text-slate-700">
            We use this email for your order and account setup link. You will create a password after payment — no
            account is required before checkout.
          </p>
          {signedInUser ? (
            <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
              Signed in as <strong>{signedInUser.email}</strong>. Guest checkout still uses the form below for this
              pay-first path, or continue as a new purchaser email.
            </p>
          ) : null}
          <form action={submitGuestCheckoutAction} className="mt-6 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="resume" value={resume} />
            <Field name="email" label="Email" type="email" defaultValue={signedInUser?.email ?? ""} />
            <Field name="firstName" label="First name" defaultValue={signedInUser?.firstName ?? ""} />
            <Field name="lastName" label="Last name" defaultValue={signedInUser?.lastName ?? ""} />
            <label className="text-sm font-medium text-slate-800">
              Timezone
              <select
                name="timezone"
                required
                defaultValue={DEFAULT_CHECKOUT_TIMEZONE}
                className="qr-field mt-1"
              >
                {COMMON_TIMEZONES.map((zone) => (
                  <option key={zone.value} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </select>
            </label>
            <Field name="country" label="Country code" defaultValue="US" maxLength={2} />
            <label className="text-sm font-medium text-slate-800 sm:col-span-2">
              Referral code <span className="font-normal text-slate-600">(optional)</span>
              <input
                name="referralCode"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={64}
                defaultValue={prefilledReferralCode}
                placeholder="QR-XXXXXXXX"
                className="qr-field mt-1"
              />
              <span className="mt-1 block text-xs font-normal text-slate-600">
                {prefilledReferralCode
                  ? "Prefilled from your referral link. You can change or clear it. Invalid codes are ignored and do not block checkout."
                  : "If someone referred you, paste their code here. Invalid codes are ignored and do not block checkout. Coupon codes are entered separately above."}
              </span>
            </label>
            <label className="flex gap-3 text-sm text-slate-800 sm:col-span-2">
              <input type="checkbox" name="agreementAccepted" required value="on" className="mt-0.5" />
              <span>I agree to the terms and confirm this order information is accurate.</span>
            </label>
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:col-span-2">
              {billingConfigured
                ? "Submitting creates your order and takes you to secure checkout. After payment you will set a password via a secure link."
                : "Submitting creates an unpaid order. After payment you will set a password via a secure link."}{" "}
              No domains, mailboxes, or live sends are provisioned at this step.
            </p>
            <button className="funnel-primary w-full sm:col-span-2">
              {billingConfigured ? "Continue to secure checkout" : "Continue to payment"}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link className="font-semibold text-indigo-700 underline" href="/sign-in">
              Sign in
            </Link>
          </p>
        </section>
      </main>
    </FunnelShell>
  );
}

async function resolveConfirmationOrder(input: {
  orderId?: string;
  signedInUserId?: string | null;
  draftSessionId?: string;
}) {
  const cookieSession = await getDraftSession();
  const sessionId = input.draftSessionId ?? cookieSession?.id ?? null;
  const userId = input.signedInUserId ?? null;

  if (input.orderId) {
    return prisma.customerOrder.findFirst({
      where: {
        id: input.orderId,
        OR: [
          ...(sessionId ? [{ acquisitionSessionId: sessionId }] : []),
          ...(userId ? [{ userId }] : []),
          { userId: null },
        ],
      },
    });
  }

  if (userId) {
    return prisma.customerOrder.findFirst({
      where: {
        userId,
        ...(sessionId ? { acquisitionSessionId: sessionId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  if (sessionId) {
    return prisma.customerOrder.findFirst({
      where: { acquisitionSessionId: sessionId, userId: null },
      orderBy: { createdAt: "desc" },
    });
  }

  return null;
}

async function renderOrderPaymentState({
  order: initialOrder,
  searchParams,
  checkoutState,
}: {
  order: CustomerOrder;
  searchParams: {
    testPayment?: string;
    setupToken?: string;
    emailDelivery?: string;
    checkoutError?: string;
  };
  checkoutState?: string;
}) {
  let order = initialOrder;
  const billing = getBillingConfig();
  if (checkoutState === "success" && order.paymentStatus !== "PAID" && billing.configured) {
    try {
      const { reconcilePaidCheckoutSession } = await import("@/lib/stripe/commerce");
      const reconciled = await reconcilePaidCheckoutSession(order.id);
      order = reconciled.order;
    } catch {
      // Webhook may still arrive; keep the unpaid Stripe CTA visible.
    }
  }

  const paid = order.paymentStatus === "PAID";
  const emailDelivery = parseAccountSetupEmailDelivery(searchParams.emailDelivery);
  let setupUrl =
    searchParams.setupToken && paid
      ? `/setup/account?token=${encodeURIComponent(searchParams.setupToken)}`
      : null;
  if (paid && !order.userId && !emailDelivery && !setupUrl) {
    try {
      const issued = await issueAccountSetupToken(order.id);
      const params = new URLSearchParams({
        submitted: "1",
        orderId: order.id,
        emailDelivery: issued.emailDelivery,
      });
      if (checkoutState) params.set("checkout", checkoutState);
      if (searchParams.testPayment) params.set("testPayment", searchParams.testPayment);
      if (issued.emailDelivery !== "SENT") params.set("setupToken", issued.rawToken);
      redirect(`/setup/confirmation?${params.toString()}`);
    } catch {
      setupUrl = null;
    }
  }

  const invite = confirmationSetupInvitePresentation(emailDelivery);
  const showCheckEmail = paid && Boolean(setupUrl || emailDelivery) && invite.showCheckEmail;
  const showSetupLink = paid && Boolean(setupUrl) && invite.showOnPageSetupLink;

  return (
    <FunnelShell>
      <main className="mx-auto max-w-3xl px-5 py-16">
        <FunnelProgress current={6} />
        <p className="funnel-eyebrow">{paid ? "Payment verified" : "Order submitted"}</p>
        <h1 className="funnel-title mt-3 text-4xl font-semibold">
          {paid ? "Set up your Quantum Reach account." : "Review and pay when ready."}
        </h1>
        <p className="mt-4 text-slate-700">
          Order <span className="font-mono text-sm text-slate-800">{order.id}</span> is{" "}
          <strong>{order.paymentStatus.toLowerCase()}</strong>
          {order.purchaserEmail ? (
            <>
              {" "}
              for <strong>{order.purchaserEmail}</strong>
            </>
          ) : null}
          . No infrastructure purchase or provider provisioning is claimed before clearance and account setup.
        </p>

        {searchParams.checkoutError ? (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
            {searchParams.checkoutError}
          </p>
        ) : null}

        {searchParams.testPayment === "failed" ? (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
            The test payment could not be completed safely. Refresh and try again.
          </p>
        ) : null}

        {showCheckEmail ? (
          <section className="mt-7 space-y-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-950/40">
            <h2 className="font-semibold text-emerald-950 dark:text-emerald-100">Next: create your password</h2>
            <p className="text-sm text-emerald-900 dark:text-emerald-200">
              {order.paymentMethod === "SIMULATED_TEST"
                ? "Test payment completed — no real card was charged. "
                : "Payment is confirmed. Workspace provisioning starts after you create your password. "}
              Check <strong>{order.purchaserEmail}</strong> for your secure setup link. It is valid about{" "}
              {ACCOUNT_SETUP_TOKEN_TTL_HOURS} hours and can be used once.
            </p>
            <form action={resendAccountSetupEmailAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <button className="text-sm font-semibold text-emerald-900 underline dark:text-emerald-100">
                Resend setup email
              </button>
            </form>
          </section>
        ) : null}

        {showSetupLink && setupUrl ? (
          <section className="mt-7 space-y-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-950/40">
            <h2 className="font-semibold text-emerald-950 dark:text-emerald-100">Next: create your password</h2>
            <p className="text-sm text-emerald-900 dark:text-emerald-200">
              {order.paymentMethod === "SIMULATED_TEST"
                ? "Test payment completed — no real card was charged. Live email delivery is deferred in this environment."
                : "Payment is confirmed. Workspace provisioning starts after you create your password."}{" "}
              Use the secure setup link below (valid about {ACCOUNT_SETUP_TOKEN_TTL_HOURS} hours) to set your password
              and activate your workspace.
            </p>
            <p className="text-sm text-emerald-900 dark:text-emerald-200">
              {emailDelivery === "FAILED" ? (
                "We could not email the setup link. Use the secure link below."
              ) : (
                <>
                  When email sending is enabled in production, this link is also emailed to{" "}
                  <strong>{order.purchaserEmail}</strong>.
                </>
              )}
            </p>
            <Link className="funnel-primary inline-flex w-full" href={setupUrl}>
              Open account setup
            </Link>
          </section>
        ) : null}

        {billing.configured && !paid ? (
          <section className="mt-7 rounded-2xl border-2 border-indigo-300 bg-indigo-50 p-6 dark:border-indigo-700 dark:bg-indigo-950/40">
            <h2 className="font-semibold text-indigo-950 dark:text-indigo-100">Pay with Stripe</h2>
            <p className="mt-2 text-sm text-indigo-900 dark:text-indigo-200">
              Stripe test-mode checkout. No live charges. After payment you will receive an account setup link
              {order.purchaserEmail ? (
                <>
                  {" "}
                  for <strong>{order.purchaserEmail}</strong>
                </>
              ) : null}
              . Nothing is provisioned until you create your password.
            </p>
            {checkoutState === "cancelled" ? (
              <p role="alert" className="mt-3 text-sm text-amber-800">
                Checkout was cancelled. You can try again.
              </p>
            ) : null}
            <StripeCheckoutButton orderId={order.id} />
          </section>
        ) : null}

        {!billing.configured && !paid ? (
          <p className="mt-7 rounded-xl border bg-amber-50 p-4 text-sm text-amber-950">
            Live checkout is not enabled in this environment. An operator can clear payment manually when appropriate.
          </p>
        ) : null}

        {paid && !setupUrl && !showCheckEmail ? (
          <p className="mt-7 rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
            Payment is recorded. If you did not receive a setup link, contact support with your order id.
          </p>
        ) : null}
      </main>
    </FunnelShell>
  );
}

function Row({
  label,
  value,
  edit,
  emphasize,
}: {
  label: string;
  value: string;
  edit?: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-5 border-b border-slate-200 px-5 py-4 last:border-0">
      <span className={emphasize ? "font-medium text-slate-800" : "text-slate-700"}>{label}</span>
      <span className={`text-right font-semibold text-slate-950 ${emphasize ? "text-lg" : ""}`}>
        {value}
        {edit ? (
          <Link className="ml-3 text-sm font-semibold text-indigo-700 underline" href={edit}>
            Edit
          </Link>
        ) : null}
      </span>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  maxLength = 160,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  maxLength?: number;
}) {
  return (
    <label className="text-sm font-medium text-slate-800">
      {label}
      <input
        name={name}
        type={type}
        required
        maxLength={maxLength}
        defaultValue={defaultValue}
        className="qr-field mt-1"
      />
    </label>
  );
}
