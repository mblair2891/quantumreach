# Stripe Hard Gate

When `BILLING_ENABLED=false`, private-beta/development behavior remains open. When `BILLING_ENABLED=true`, normal SaaS access requires an active/trialing workspace subscription. `ADMIN_EMAILS` users can bypass for internal operations. Public routes for auth, webhooks, health, unsubscribe, booking, and signing remain accessible.
