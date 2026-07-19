# platform operations

Quantum Reach is operated as a multi-tenant SaaS platform. The platform console under /platform is for company operations: subscribers, workspaces, subscriptions, plans, revenue readiness, affiliates, commissions, payouts, provisioning, managed domains, email infrastructure, providers, support, audit, and settings.

Subscriber business tools live under /dashboard. Client-company subscribers are full SaaS tenants with isolated workspaces. Client portal users remain limited /portal users and are never treated as full SaaS workspace owners.

Stripe controls software subscription access. Skool membership records course/community context only and must not become a runtime dependency for software access. Affiliate attribution uses a documented last-touch foundation, blocks self-referrals, and creates commissions only from successful eligible payments. White-label branding is entitlement-gated and Quantum Reach remains the underlying SaaS provider.

## Operator entry and catalog activation
Platform operators listed in `ADMIN_EMAILS` use `/platform` as their generic post-authentication destination. They can intentionally open their subscriber workspace at `/dashboard`; the platform/workspace context control is navigation only and does not grant additional access. The operator catalog is initialized through the idempotent **Initialize Quantum Reach Catalog** action. It persists the default products and entitlement records but never creates Stripe prices.
