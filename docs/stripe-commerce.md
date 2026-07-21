# Stripe commerce

Stripe is optional until `BILLING_ENABLED=true`; manual and complimentary clearance remain supported. Configure the Stripe secret key, webhook secret, and application URL, then map every sellable `CommerceProduct` to a Stripe Price ID in **/platform/catalog**. The persisted catalog—not browser input—is the checkout source of truth.

The webhook endpoint is `POST /api/billing/webhook`. Subscribe it to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `invoice.paid`, `refund.created`, `refund.updated`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, and `customer.subscription.*`. Checkout completion and `invoice.paid` are payment-success authorities; duplicate deliveries are recorded by Stripe event ID and are safe to retry.

For local testing, run `stripe listen --forward-to localhost:3000/api/billing/webhook`, put the resulting signing secret in local environment configuration, map test Price IDs in the catalog, and complete Checkout with Stripe test cards. Enable the Stripe Billing Portal in the Stripe Dashboard before using the portal endpoint.

Before live mode: approve pricing, create live Products/Prices, map them in the catalog, set live credentials and a verified live webhook endpoint, configure portal settings, exercise refund/dispute handling, and complete a production smoke test. Refunds and disputes are retained for operator review; no workspace is automatically deleted.
