# Infrastructure operations

## Safety
All external automation is fail-closed. `DOMAIN_PURCHASING_ENABLED`, `DNS_AUTOMATION_ENABLED`, and `EMAIL_SENDING_ENABLED` remain false by default; email sandbox mode remains enabled by default. A missing provider configuration produces a blocked/retryable state, never a simulated success.

## Jobs and cron
`POST /api/internal/jobs/run` (also `GET` for scheduler compatibility) requires a Bearer `JOB_RUNNER_SECRET` or `CRON_SECRET`. It recovers expired ten-minute leases and claims up to ten queued jobs using a conditional database update. Suggested schedule: every minute for this route. Jobs have durable idempotency keys, attempts, exponential retry, operator cancellation, and safe error summaries.

## Providers
Cloudflare automation uses `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` only when explicitly enabled. The adapter marks records it creates and refuses zone wipes or deletion of unmanaged records. Mailbox provisioning is provider-neutral; the disabled provider blocks rather than creates mailboxes. SES remains configuration-required until the approved AWS SDK dependency can be installed and credentials are configured. Inbound mailbox synchronization likewise remains provider-adapter dependent.

## Deployment smoke test
Keep all external flags disabled, migrate and build, invoke the internal runner with its secret, and verify its JSON summary. Configure one provider in a non-production account at a time, validate provider health, then enable the related feature flag only after an operator review.
