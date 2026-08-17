# Stripe test-mode commerce

## Architecture and safety

`BILLING_ENABLED=false` is the rollback switch. The server-only provider boundary uses the official Stripe Node SDK 17.7.0 with a lazy, reusable client. Checkout loads the persisted order, maps stable product codes to server-only `STRIPE_PRICE_*` variables, and redirects to a Stripe-hosted session. It never accepts a browser amount, Price, or Customer ID. Manual and complimentary clearance are unchanged.

Pay-first guest checkout is supported. `POST /api/billing/checkout` does not require a signed-in user for guest orders. Access is granted when the caller owns the acquisition session cookie, matches the persisted order owner, or matches the purchaser email on an unclaimed order. Authenticated orders still require the owning user.

Guest Checkout creates or reuses a Stripe Customer from `purchaserEmail` and stores `stripeCustomerId` on the order. `StripeCustomerLink` is written only after the purchaser claims the order at `/setup/account`. Authenticated Checkout keeps the existing customer-link path.

Standard Setup (`$0`) is omitted from Stripe line items. Subscription Checkout may include one-time Priority Setup on the first invoice alongside recurring Core and package prices. Success and cancel URLs return to `/setup/confirmation` with `orderId` and `checkout=success|cancelled`. If the webhook is late, the success return retrieves the Checkout Session and applies the same clearance.

Stripe posts to canonical `POST /api/webhooks/stripe`; only this endpoint should be registered in Stripe. The legacy `/api/billing/webhook` route is a temporary compatibility alias to the same handler and has no separate financial logic. The route reads the raw body and verifies `Stripe-Signature` with `stripe.webhooks.constructEvent` before writing or processing anything. The unique event ledger makes delivery through either path harmless and retryable. Paid Checkout is the canonical initial-clearance event; invoice events never grant initial clearance. The centralized customer-journey service grants `STRIPE` clearance.

If the order has no `userId`, clearance marks the order `PAID` with `paymentMethod: STRIPE` and returns `{ requiresAccountSetup: true }`. Workspace creation, entitlements, and fulfillment wait until password setup. Subscription events that arrive before user and workspace exist store `stripeSubscriptionId` on the order only. After claim, `completeAccountSetup` upserts `StripeCustomerLink` from `order.stripeCustomerId` and then fulfills. Replay of a processed event is a no-op and does not double-fulfill.

Simulated payment remains available only in Preview or local development, alongside Stripe TEST when billing is configured.

## Configuration

Configure `DATABASE_URL`, `DIRECT_DATABASE_URL`, `BILLING_ENABLED`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `APP_BASE_URL` (or `NEXT_PUBLIC_APP_URL`), and the applicable product mappings listed in `.env.example` in Vercel Preview. Put secrets in `.env.local`, Vercel environment settings, or an equivalent secret store. Keys and webhook secrets must never be committed. Only mappings for products in an order are required. Keep `BILLING_ENABLED=false` until migrations and preview validation pass. Production/live charges stay off until explicitly enabled.

### Stripe CLI test-mode sequence

Run these commands locally, not against production:

```bash
stripe login
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
```

Copy the `whsec_...` signing secret printed by `stripe listen` directly into `.env.local` as `STRIPE_WEBHOOK_SECRET`; never paste that secret into chat, source control, tickets, or documentation. In another terminal, verify signed delivery with:

```bash
stripe trigger checkout.session.completed
```

Then complete a full test-mode Checkout through the application using Stripe's current test-card documentation. Find the resulting event ID in the Stripe Dashboard or CLI output and replay the exact same event:

```bash
stripe events resend evt_REPLACE_WITH_TEST_EVENT_ID
```

Confirm the webhook ledger contains one provider event ID and that the replay creates no duplicate workspace, owner membership, product assignment, notification intent, or affiliate commission.

## Smoke test

1. Complete `/start`, `/join`, infrastructure selection, and Standard or Priority setup as a new prospect.
2. At `/setup/confirmation`, continue to Checkout and complete a Stripe test-mode payment.
3. Confirm one webhook ledger row, `STRIPE` clearance, enrollment activation, one workspace/owner/profile, Core and package assignments, setup priority, notification, queue, attribution, and at most one pending commission.
4. Replay the same event and confirm no duplicates.
5. Exercise asynchronous failure, subscription cancellation/past-due, partial/full refund, and dispute fixtures. Confirm billing/review state changes but no destructive deprovisioning.
6. Separately verify MANUAL and COMPLIMENTARY operator clearance.

### Preview guest Stripe TEST checklist

Complete this on Vercel Preview with billing configured. Do not use live keys.

1. **Guest pay → setup → workspace.** Stay signed out. Complete `/start` → package → priority → `/setup/confirmation`. Submit purchaser details to create an unpaid guest order. Choose **Pay with Stripe**, pay with card `4242 4242 4242 4242` (any future expiry, any CVC, any ZIP). After return, confirm the order is `PAID` with `paymentMethod: STRIPE` and no workspace exists yet. When `EMAIL_SENDING_ENABLED=true` and SES accepts the message, confirmation says to check the purchaser email (from `noreply@quantumreach.app`) instead of showing the raw setup URL. With sending disabled or a send failure, the on-page setup link remains. Open `/setup/account`, set a password, and confirm the order is claimed, the workspace is created, and the Stripe customer is linked to the new user.
2. **Priority vs Standard line items.** Repeat Standard setup and confirm Stripe Checkout has no `$0` / Standard Setup line. Repeat Priority setup and confirm recurring Core + package plus one-time Priority Setup on the first invoice.
3. **Replay does not double-fulfill.** In the Stripe Dashboard or CLI, resend the same `checkout.session.completed` event. Confirm one workspace, one owner membership, one fulfillment, and one setup token use. A second password setup with the same link must fail.
4. **Referral and operator.** Enter through a partner referral code, complete guest Stripe TEST checkout and account setup, and confirm attribution remains locked to that referral. As an operator, open the subscriber and confirm the paid order and workspace are visible. Complimentary clearance must not create affiliate membership. Coupons are not affiliate codes.

## Activation and rollback

Before activation: deploy migrations to Preview, configure test keys and required Prices, register the webhook, run automated checks and the smoke test, then explicitly set `BILLING_ENABLED=true`. Production/live mode is not activated by this implementation. To roll back, set `BILLING_ENABLED=false`; keep the signed webhook deployed so already-created sessions can reconcile, and retain all ledger records.
