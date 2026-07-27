# Vercel Cron job runner

Configure Vercel Cron to invoke `GET /api/internal/jobs/run` with an
`Authorization: Bearer $JOB_RUNNER_SECRET` header.  `CRON_SECRET` is supported
as a backwards-compatible fallback.  At least one secret is required; requests
without a matching secret fail closed with `401`.

The handler processes at most 50 jobs per invocation (10 by default), recovers
expired worker leases, and returns a safe structured summary.  It must never be
configured with an unauthenticated public schedule.
