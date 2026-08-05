import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getOptionalUserProfile } from "@/lib/auth/rbac";
import { catalogPrice, loadValidatedDraft, money } from "@/lib/customer-journey/acquisition-draft";
import { buildAcquisitionChargeSummary } from "@/lib/commercial/charge-lines";
import { applyCouponToSummary, getAppliedCoupon, type CouponCalculation } from "@/lib/commercial/coupons";
import {
  applyCouponAction,
  removeCouponAction,
  simulateSuccessfulPaymentAction,
  submitGuestCheckoutAction,
} from "./actions";
import { FunnelProgress } from "@/components/funnel/progress";
import { FunnelShell } from "@/components/funnel/shell";
import { SimulatedPaymentButton } from "@/components/funnel/simulated-payment-button";
import { isSimulatedPaymentEnvironment } from "@/lib/simulated-payment/environment";
import { ACCOUNT_SETUP_TOKEN_TTL_HOURS } from "@/lib/auth/constants";
import { COMMON_TIMEZONES, DEFAULT_CHECKOUT_TIMEZONE } from "@/lib/customer-journey/timezones";

export default async function Confirmation({
  searchParams,
}: {
  searchParams: {
    submitted?: string;
    couponMessage?: string;
    testPayment?: string;
    orderId?: string;
    setupToken?: string;
    checkoutError?: string;
  };
}) {
  let selection;
  try {
    selection = await loadValidatedDraft();
  } catch {
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

  const signedInUser = await getOptionalUserProfile();
  const resume = selection.session.anonymousId ?? selection.session.id;
  const plan = charges.plan;

  // Post-submit: payment / setup invite state
  if (searchParams.submitted === "1") {
    const order = searchParams.orderId
      ? await prisma.customerOrder.findFirst({
          where: {
            id: searchParams.orderId,
            OR: [
              { acquisitionSessionId: selection.session.id },
              ...(signedInUser ? [{ userId: signedInUser.id }] : []),
            ],
          },
        })
      : signedInUser
        ? await prisma.customerOrder.findFirst({
            where: { userId: signedInUser.id, acquisitionSessionId: selection.session.id },
            orderBy: { createdAt: "desc" },
          })
        : await prisma.customerOrder.findFirst({
            where: { acquisitionSessionId: selection.session.id, userId: null },
            orderBy: { createdAt: "desc" },
          });

    if (order) {
      const paid = order.paymentStatus === "PAID";
      const setupUrl =
        searchParams.setupToken && paid
          ? `/setup/account?token=${encodeURIComponent(searchParams.setupToken)}`
          : null;

      return (
        <FunnelShell>
          <main className="mx-auto max-w-3xl px-5 py-16">
            <FunnelProgress current={6} />
            <p className="funnel-eyebrow">{paid ? "Payment verified" : "Order submitted"}</p>
            <h1 className="funnel-title mt-3 text-4xl font-semibold">
              {paid ? "Set up your Quantum Reach account." : "Review and pay when ready."}
            </h1>
            <p className="mt-4 text-slate-600">
              Order <span className="font-mono text-sm">{order.id}</span> is{" "}
              <strong>{order.paymentStatus.toLowerCase()}</strong>
              {order.purchaserEmail ? (
                <>
                  {" "}
                  for <strong>{order.purchaserEmail}</strong>
                </>
              ) : null}
              . No infrastructure purchase or provider provisioning is claimed before clearance and account setup.
            </p>

            {searchParams.testPayment === "failed" ? (
              <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                The test payment could not be completed safely. Refresh and try again.
              </p>
            ) : null}

            {paid && setupUrl ? (
              <section className="mt-7 space-y-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-950/40">
                <h2 className="font-semibold text-emerald-950 dark:text-emerald-100">Next: create your password</h2>
                <p className="text-sm text-emerald-900 dark:text-emerald-200">
                  Test payment completed — no real card was charged. Live email delivery is deferred in this environment.
                  Use the secure setup link below (valid about {ACCOUNT_SETUP_TOKEN_TTL_HOURS} hours) to set your password
                  and activate your workspace.
                </p>
                <p className="text-sm text-emerald-900 dark:text-emerald-200">
                  When email sending is enabled in production, this link is also emailed to{" "}
                  <strong>{order.purchaserEmail}</strong>.
                </p>
                <Link className="funnel-primary inline-flex w-full" href={setupUrl}>
                  Open account setup
                </Link>
              </section>
            ) : null}

            {isSimulatedPaymentEnvironment() && !paid ? (
              <section className="mt-7 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 p-6 dark:border-indigo-700 dark:bg-indigo-950/40">
                <h2 className="font-semibold text-indigo-950 dark:text-indigo-100">Preview payment testing</h2>
                <p className="mt-2 text-sm text-indigo-900 dark:text-indigo-200">
                  Preview test payment — no real card will be charged. After payment you will receive an account setup
                  link (shown on this page when email is not live).
                </p>
                <form action={simulateSuccessfulPaymentAction} className="mt-5">
                  <input type="hidden" name="orderId" value={order.id} />
                  <SimulatedPaymentButton />
                </form>
              </section>
            ) : null}

            {!isSimulatedPaymentEnvironment() && !paid ? (
              <p className="mt-7 rounded-xl border bg-amber-50 p-4 text-sm text-amber-950">
                Live checkout is not enabled in this environment. An operator can clear payment manually when appropriate.
              </p>
            ) : null}

            {paid && !setupUrl ? (
              <p className="mt-7 rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
                Payment is recorded. If you did not receive a setup link, contact support with your order id.
              </p>
            ) : null}
          </main>
        </FunnelShell>
      );
    }
  }

  return (
    <FunnelShell>
      <main className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
        <FunnelProgress current={4} />
        <p className="text-center funnel-eyebrow">Step 4 · Review & checkout</p>
        <h1 className="text-center funnel-title mt-3 text-4xl font-semibold">Review your Quantum Reach order.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-slate-600">
          Pay first, then create your password from a secure setup link. Nothing is provisioned until payment is
          verified and your account is created.
        </p>

        {searchParams.checkoutError ? (
          <p role="alert" className="mx-auto mt-6 max-w-2xl rounded-xl bg-red-50 p-4 text-sm text-red-800">
            {searchParams.checkoutError}
          </p>
        ) : null}

        <section className="mt-10 rounded-2xl border bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">{plan.name} package</h2>
              <p className="mt-2 text-slate-600">Quantum Reach software included</p>
            </div>
            <Link className="text-sm font-semibold text-indigo-700 underline" href="/start">
              Edit package
            </Link>
          </div>
          <ul className="mt-5 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
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

        <section className="mt-6 rounded-2xl border bg-white p-6">
          <h2 className="font-semibold">Coupon</h2>
          {applied ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {applied.coupon.displayName} · {applied.normalizedCodeSnapshot}
                </p>
                <p className="text-sm text-emerald-700">
                  You save {money(couponCalculation?.totalCouponSavingsCents ?? 0)} today.
                </p>
              </div>
              <form action={removeCouponAction}>
                <button className="text-sm font-semibold text-red-700 underline">Remove coupon</button>
              </form>
            </div>
          ) : null}
          <form action={applyCouponAction} className="mt-4 flex flex-wrap gap-3">
            <input name="code" required aria-label="Coupon code" placeholder="Coupon code" className="rounded-lg border px-3 py-2" />
            <input type="hidden" name="replace" value={applied ? "true" : "false"} />
            <button className="rounded-lg bg-slate-950 px-4 py-2 text-white">
              {applied ? "Replace coupon" : "Apply coupon"}
            </button>
          </form>
          {couponMessage ? (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {couponMessage}
            </p>
          ) : null}
        </section>

        <div className="mt-6 overflow-hidden rounded-2xl border bg-white">
          <Row label="Monthly package fee" value={money(plan.monthlyCents)} />
          <Row label="One-time implementation fee" value={money(plan.setupCents)} />
          <Row label="Setup priority" value={selection.setup.name} edit="/setup/priority" />
          <Row
            label={selection.setup.key === "STANDARD_SETUP" ? "Standard" : "Head of the line"}
            value={setupPrice.oneTimeCents === 0 ? "Included" : money(setupPrice.oneTimeCents)}
          />
          <Row label="Today’s total" value={money(charges.todayTotalCents)} />
          <Row label="Recurring monthly fee" value={`${money(charges.recurringMonthlyCents)}/month`} />
          <Row label="Financial state" value="Unpaid · pay before account setup" />
        </div>

        <section className="mt-8 rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-semibold">Purchaser details</h2>
          <p className="mt-2 text-sm text-slate-600">
            We use this email for your order and account setup link. You will create a password after payment — no
            account is required before checkout.
          </p>
          {signedInUser ? (
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              Signed in as <strong>{signedInUser.email}</strong>. Guest checkout still uses the form below for this
              pay-first path, or continue as a new purchaser email.
            </p>
          ) : null}
          <form action={submitGuestCheckoutAction} className="mt-6 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="resume" value={resume} />
            <Field name="email" label="Email" type="email" defaultValue={signedInUser?.email ?? ""} />
            <Field name="businessName" label="Business name" />
            <Field name="firstName" label="First name" defaultValue={signedInUser?.firstName ?? ""} />
            <Field name="lastName" label="Last name" defaultValue={signedInUser?.lastName ?? ""} />
            <label className="text-sm font-medium text-slate-700">
              Timezone
              <select
                name="timezone"
                required
                defaultValue={DEFAULT_CHECKOUT_TIMEZONE}
                className="mt-1 w-full rounded-xl border px-3 py-2 bg-white text-slate-950"
              >
                {COMMON_TIMEZONES.map((zone) => (
                  <option key={zone.value} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </select>
            </label>
            <Field name="country" label="Country code" defaultValue="US" maxLength={2} />
            <label className="flex gap-3 text-sm sm:col-span-2">
              <input type="checkbox" name="agreementAccepted" required value="on" />
              <span>I agree to the terms and confirm this order information is accurate.</span>
            </label>
            <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 sm:col-span-2">
              Submitting creates an unpaid order. After test or live payment you will set a password via a secure link.
              No domains, mailboxes, or live sends are provisioned at this step.
            </p>
            <button className="funnel-primary w-full sm:col-span-2">Continue to payment</button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-500">
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

function Row({ label, value, edit }: { label: string; value: string; edit?: string }) {
  return (
    <div className="flex items-center justify-between gap-5 border-b px-5 py-4 last:border-0">
      <span className="text-slate-600">{label}</span>
      <span className="text-right font-semibold">
        {value}
        {edit ? (
          <Link className="ml-3 text-sm text-indigo-700 underline" href={edit}>
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
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input
        name={name}
        type={type}
        required
        maxLength={maxLength}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-xl border px-3 py-2"
      />
    </label>
  );
}
