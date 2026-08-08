# Quantum Reach private beta launch guide

## Supported production workflow

The validated meeting workflow remains Zoom-first: create a Zoom meeting in Quantum Reach, start the Zoom session from Quantum Reach, let lifecycle webhooks synchronize status, end the meeting, upload the local recording, then allow the recording-to-transcript-to-analysis workflow to continue. Local recording upload supports M4A files. Zoom cloud recording import code is preserved, but private-beta operations should treat it as unavailable unless the Zoom account plan includes cloud recording.

## Required setup

- Configure Clerk, database, OpenAI, Cloudflare R2, Zoom OAuth, and Zoom webhook secrets in the deployment environment.
- Keep the Zoom webhook endpoint set to `https://www.quantumreach.app/api/webhooks/zoom`.
- Configure Cloudflare R2 CORS for browser uploads.
- Add `ADMIN_EMAILS` as a comma-separated allowlist for internal operator access.
- On Preview, create the first operator in the browser at `/setup/operator` (see `docs/operator-bootstrap-preview.md`). Do not rely on a local machine for Preview seeding.
- Leave `BILLING_ENABLED=false` until Stripe checkout, portal, webhook, and catalog Price IDs are fully configured.

## Billing behavior

Billing is private-beta safe. When `BILLING_ENABLED` is not `true` or Stripe variables are absent, the billing page renders a disabled state and core app usage continues. Checkout and portal routes require authentication and return a safe disabled response instead of requiring Stripe at build time.

## Operator dashboard

`/dashboard/operator` is protected by normal workspace authentication and the `ADMIN_EMAILS` allowlist. It shows safe operational counts, recent meetings, failed webhook summaries, and failed transcription summaries. It does not expose provider tokens, encrypted credentials, webhook signatures, raw payloads, or secrets.

## Smoke test checklist

1. Sign in and create or select a workspace.
2. Complete onboarding or skip to the dashboard.
3. Connect Zoom from the integrations center.
4. Create a Zoom meeting, start it, end it, and confirm webhook lifecycle status updates.
5. Upload a local Zoom recording, including an M4A sample, and confirm transcript/analysis handoff status.
6. Upload and delete a knowledge document.
7. Create CRM records, outreach drafts, action items, and deliverables.
8. Visit billing with billing disabled and confirm the app remains usable.
9. Visit `/api/health` and confirm the minimal public health response.
10. Visit `/dashboard/operator` as an allowlisted email and confirm safe diagnostics render.

## Known limitations and deferred items

- Zoom cloud recording import depends on the Zoom account plan and remains operationally deferred.
- Stripe SDK-backed checkout and portal session creation remain deferred until billing is enabled for private beta.
- Email sending is not enabled by default; outreach remains a draft/planning workflow unless a provider is intentionally added later.
