# Vercel Cron job runner

`vercel.json` invokes `GET /api/internal/jobs/run` hourly. Vercel Cron sends
`Authorization: Bearer $CRON_SECRET` when that env var is set. `JOB_RUNNER_SECRET`
is also accepted. At least one secret is required; requests without a matching
secret fail closed with `401`.

The handler processes at most 50 jobs per invocation (10 by default), recovers
expired worker leases, and returns a safe structured summary.  It must never be
configured with an unauthenticated public schedule.
