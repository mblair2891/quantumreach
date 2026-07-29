# Commercial Preview smoke test

1. Open `/`, choose **Join now**, select a package, and review recurring/setup amounts and unpaid notices.
2. Sign up, submit the unpaid order, apply authorized manual clearance, and provision the workspace.
3. Open managed sending, verify limits, create simulated domains/mailboxes, and confirm live sending is blocked.
4. Simulate DNS/tests and daily healthy evidence under `QUANTUM_REACH_WARMUP_VALIDATION`; confirm score/reasons, promotion only after every gate, bounce demotion, queue hold, recovery, and re-promotion.
5. In AI settings, enter only a subscriber-owned development key directly (never in chat), enable one model, test authorized client selection/usage, verify keys are hidden, and verify another workspace cannot access any record.
6. Confirm provider/cost screens are operator-only and all simulations remain labeled.

## Database and build gate

Set `DATABASE_URL`, `DIRECT_DATABASE_URL`, and `TEST_DATABASE_CONFIRMATION=quantumreach_test` to an isolated non-production PostgreSQL database. Run `npm run test:db`, `npm run prisma:migrate:deploy`, and `npm run build`. The harness refuses to run without the explicit test-database confirmation and never prints connection strings.

Keep `DOMAIN_PROVISIONING_ENABLED`, `MAILBOX_PROVISIONING_ENABLED`, `DNS_AUTOMATION_ENABLED`, `SES_SENDING_ENABLED`, and `LIVE_CAMPAIGN_SENDING_ENABLED` off. Operator simulation uses only profiles labeled `QUANTUM_REACH_WARMUP_VALIDATION`. Add DNS, outbound-test, inbound-test, health sample, healthy-day, failure, recovery, and re-promotion evidence individually; never use a one-click completion.

Confirm direct SES calls return `LIVE_SENDING_CONTEXT_REQUIRED`, queued campaign work uses the managed send service, capacity totals separate live and simulated reservations, temporary overrides expire, clients see only approved AI models, and contact/team/storage mutations return stable plan-limit errors.
