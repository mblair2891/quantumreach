# Subscriber preview smoke test

Use an isolated preview database and a new project-owner-controlled email. Never use production Stripe or infrastructure credentials.

1. Open the Vercel Preview root URL in a private window.
2. Select the primary CTA.
3. Confirm `/start` displays the active subscriber package before Clerk.
4. Select the core package.
5. Select the test-safe infrastructure package.
6. Select setup priority.
7. Review the complete order.
8. Confirm one-time and recurring amounts are clearly separated.
9. Select **Create account and continue**.
10. Complete Clerk sign-up using a new controlled test email.
11. Confirm the flow resumes with the same core, infrastructure, and priority selections.
12. Complete `/join` for Taylor Reed and BrightPath Client Growth.
13. Submit the order.
14. Confirm the confirmation page says the order is unpaid and makes no payment or provider claim.
15. Confirm `/setup/confirmation`.
16. Confirm `/setup/status` shows financial clearance pending and no workspace yet.
17. Have an authorized operator apply manual or complimentary clearance in `/platform/setup-queue`; there is no public free-activation control.
18. Confirm workspace, membership, subscription, entitlements, and deferred infrastructure state.
19. Complete `/dashboard/onboarding`.
20. Reach `/dashboard`, verify subscriber navigation, `/platform` denial, tenant isolation, sign-out/sign-in resume, and retry idempotency.

Required non-secret configuration: seed the active core plan and active commerce products, configure preview Clerk redirect URLs, designate operator emails, and use controlled subscriber emails.

Required environment variable names are `DATABASE_URL`, `DIRECT_DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `ADMIN_EMAILS`, `NEXT_PUBLIC_APP_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_MODE`, and `INFRASTRUCTURE_PROVISIONING_ENABLED`. Omit live provider credentials and keep provisioning disabled for this test.
