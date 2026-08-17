# Managed sending readiness (private beta)

Transactional system mail (`noreply@quantumreach.app`, `lib/email/transactional.ts`) is **not** this path. Customer outbound uses workspace sender identities on **their** domains.

## Chosen private-beta path (Path A)

**BYO domain first.** OpenSRS purchase (Path B) stays gated until Path A works.

```
Subscriber adds domain
  → SES VerifyDomainIdentity + DKIM tokens stored
  → Subscriber publishes DNS
  → Verify DNS + poll SES
  → domainReady / dkimReady only when SES evidence is Success
  → Create mailbox + sender (SES send address; hosted inbox may stay awaiting provider)
  → Warmup profile starts (day 1 cap 5)
  → Bounded test send when MANAGED_SENDING_ENABLED and caps allow
  → Bounce/complaint webhook suppresses recipient
```

## Env vars

| Variable | Purpose | Default |
| --- | --- | --- |
| `EMAIL_SENDING_ENABLED` | Master send switch (transactional + managed) | `false` |
| `MANAGED_SENDING_ENABLED` | Customer outbound / test send | `false` |
| `EMAIL_SANDBOX_MODE` | SES sandbox; unverified recipients fail | `true` |
| `WARMUP_WORKER_ENABLED` | Daily warmup sweep inside job runner | `true` unless `false` |
| `AWS_SES_REGION` | Use `us-east-2` (quantumreach.app + customer identities) | `us-east-2` |
| `AWS_SES_ACCESS_KEY_ID` / `AWS_SES_SECRET_ACCESS_KEY` | SES API | empty |
| `AWS_SES_CONFIGURATION_SET` | Event publishing | empty |
| `AWS_SES_BOUNCE_WEBHOOK_SECRET` / `AWS_SES_COMPLAINT_WEBHOOK_SECRET` | `/api/webhooks/aws-ses` | empty |
| `DOMAIN_PURCHASING_ENABLED` | OpenSRS Path B | `false` |
| `DNS_AUTOMATION_ENABLED` | Cloudflare apply for QR-managed zones | `false` |
| `JOB_RUNNER_SECRET` / `CRON_SECRET` | `GET/POST /api/internal/jobs/run` | empty |

Preview may enable BYO verify + SES identity. Bulk to unverified recipients still fails in SES sandbox.

When a gate is off, UI/API returns **Unavailable in this environment** — never silent success.

## Worker

Point Vercel Cron (or any scheduler) at `GET /api/internal/jobs/run` with `Authorization: Bearer $JOB_RUNNER_SECRET` about every minute. The runner:

1. Recovers expired leases
2. Sweeps due warmup profiles (`WARMUP_SWEEP` / inline)
3. Executes queued jobs (`MAILBOX_PROVISION`, `WARMUP_DAILY_EVALUATION`, …)

No laptop-only worker.

## Operator

`/platform/domains`: retry SES/DNS verify, or force VERIFIED/PENDING/FAILED with an audit note.

`/platform/mailboxes`: existing warmup evaluation, pause, recovery, overrides.

## Production SES posture

- Request SES production access separately from this repo.
- Keep `quantumreach.app` for transactional/system mail only.
- Customer domains are separate identities in the same region (`us-east-2`).
- Configuration sets should publish bounce/complaint to the webhook.
- Dedicated IPs are **not** required for private beta.
- Custom MAIL FROM is optional later.

## Smoke (one workspace)

1. Pay → activate (unchanged).
2. `/dashboard/onboarding`: save business profile.
3. Add BYO domain → publish DNS → Verify DNS until Verified.
4. Create mailbox `hello@domain`.
5. Banner 3/3 gone; journey 1/18 appears.
6. Send test from `/dashboard/sending/senders` to a SES-verified recipient.
7. POST bounce webhook with secret + email + workspaceId; recipient is suppressed.
