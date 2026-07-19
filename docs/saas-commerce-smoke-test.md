# SaaS commerce smoke test
1. Bootstrap the catalog and open a real workspace in Platform.
2. Assign `QUANTUM_REACH_CORE`, then `GROWTH_SENDER_PACKAGE`, with source `COMPLIMENTARY`.
3. Confirm the entitlement trace and `/dashboard/sending` show persisted Growth allowances without a restart.
4. Assign add-ons and verify quantities aggregate. Attempt a second package and verify it is blocked.
5. Deactivate a manual item and verify its allowance disappears. Confirm Stripe items cannot be edited.
