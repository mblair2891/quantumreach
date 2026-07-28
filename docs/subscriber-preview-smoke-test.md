# Subscriber preview smoke test

Use an isolated preview database and a new project-owner-controlled email. Never use production Stripe or infrastructure credentials.

1. Open the Vercel Preview root URL.
2. Use a new controlled test email.
3. Select the primary CTA.
4. Complete account creation.
5. Complete `/join` for Taylor Reed and BrightPath Client Growth.
6. Select the intended subscriber plan.
7. Select the test-safe infrastructure option.
8. Select setup priority.
9. Review the order summary.
10. Submit the order.
11. Have an authorized operator apply manual or complimentary clearance in `/platform/setup-queue`; there is no public free-activation control.
12. Return to `/setup/status`.
13. Confirm workspace creation.
14. Confirm membership creation.
15. Confirm subscription and entitlement activation.
16. Confirm infrastructure is explicitly deferred, queued, or test-safe.
17. Continue to `/dashboard/onboarding`.
18. Complete onboarding.
19. Open `/dashboard`.
20. Confirm subscriber navigation.
21. Confirm `/platform` access is denied.
22. Confirm no other tenant data is visible.
23. Confirm next-best-action guidance.
24. Confirm the example prospect action.
25. Sign out.
26. Sign back in.
27. Confirm the same workspace and progress resume.
28. Revisit setup/status and retry clearance; confirm no duplicate order, workspace, membership, subscription, entitlement, infrastructure order, or notification.

Required non-secret configuration: seed the active core plan and active commerce products, configure preview Clerk redirect URLs, designate operator emails, and use controlled subscriber emails.

Required environment variable names are `DATABASE_URL`, `DIRECT_DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `ADMIN_EMAILS`, `NEXT_PUBLIC_APP_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_MODE`, and `INFRASTRUCTURE_PROVISIONING_ENABLED`. Omit live provider credentials and keep provisioning disabled for this test.
