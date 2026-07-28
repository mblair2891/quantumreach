# Stripe test-mode commerce

## Architecture and safety

`BILLING_ENABLED=false` is the rollback switch. Checkout loads the authenticated prospect's persisted order, maps stable product codes to server-only `STRIPE_PRICE_*` variables, and redirects to a Stripe-hosted session. It never accepts a browser amount, Price, or Customer ID. Manual and complimentary clearance are unchanged.

Stripe posts to `POST /api/webhooks/stripe` (the legacy `/api/billing/webhook` alias remains supported). The route reads the raw body and verifies `Stripe-Signature` before writing or processing anything. The unique event ledger makes delivery retryable. Paid Checkout is the canonical initial-clearance event; invoice events never grant initial clearance. The centralized customer-journey service grants `STRIPE` clearance and calls the existing retry-safe fulfillment workflow.

Subscription events synchronize provider status and items without deprovisioning. Refund and dispute events retain records, update payment/review state, and reverse unpaid commissions without deleting customer resources. Replay failed events from Stripe; processed event IDs are no-ops.

## Configuration

Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `APP_BASE_URL`, and the product mappings listed in `.env.example` in Vercel Preview. Only mappings for products in an order are required. Keep `BILLING_ENABLED=false` until migrations and preview validation pass. Never commit identifiers or credentials.

For local test mode, use the official Stripe CLI to forward events to `localhost:3000/api/webhooks/stripe`, place its signing secret in `STRIPE_WEBHOOK_SECRET`, and follow Stripe's current test-card documentation. Replay an event with the Stripe CLI to verify idempotency.

## Smoke test

1. Complete `/start`, `/join`, infrastructure selection, and Standard or Priority setup as a new prospect.
2. At `/setup/confirmation`, continue to Checkout and complete a Stripe test-mode payment.
3. Confirm one webhook ledger row, `STRIPE` clearance, enrollment activation, one workspace/owner/profile, Core and package assignments, setup priority, notification, queue, attribution, and at most one pending commission.
4. Replay the same event and confirm no duplicates.
5. Exercise asynchronous failure, subscription cancellation/past-due, partial/full refund, and dispute fixtures. Confirm billing/review state changes but no destructive deprovisioning.
6. Separately verify MANUAL and COMPLIMENTARY operator clearance.

## Activation and rollback

Before activation: deploy migrations to Preview, configure test keys and required Prices, register the webhook, run automated checks and the smoke test, then explicitly set `BILLING_ENABLED=true`. Production/live mode is not activated by this implementation. To roll back, set `BILLING_ENABLED=false`; keep the signed webhook deployed so already-created sessions can reconcile, and retain all ledger records.
