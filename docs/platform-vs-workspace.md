# platform vs workspace

Quantum Reach is operated as a multi-tenant SaaS platform. The platform console under /platform is for company operations: subscribers, workspaces, subscriptions, plans, revenue readiness, affiliates, commissions, payouts, provisioning, managed domains, email infrastructure, providers, support, audit, and settings.

Subscriber business tools live under /dashboard. Client-company subscribers are full SaaS tenants with isolated workspaces. Client portal users remain limited /portal users and are never treated as full SaaS workspace owners.

Stripe controls software subscription access. Skool membership records course/community context only and must not become a runtime dependency for software access. Affiliate attribution uses a documented last-touch foundation, blocks self-referrals, and creates commissions only from successful eligible payments. White-label branding is entitlement-gated and Quantum Reach remains the underlying SaaS provider.

## Dual-role operator access
An account can be both a Quantum Reach platform operator and a workspace member. Operators see an explicit context control for **Quantum Reach Platform** and **My Workspace**; ordinary subscribers and client portal users never receive platform navigation. This control does not replace server-side platform or workspace authorization.
