# AWS SES Setup

Configure `AWS_SES_REGION`, `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY`, and optional `AWS_SES_CONFIGURATION_SET`. Verify SPF, DKIM, DMARC, and any future MAIL FROM records before live sends. SES bounce/complaint webhook handling remains disabled until webhook secrets/signature verification are configured.

## Transactional account-setup mail

Guest pay-first orders send a one-time setup link from `noreply@quantumreach.app` after payment is verified and `issueAccountSetupToken` runs. This is system mail in `lib/email/transactional.ts`. It does **not** use workspace managed-domain warmup or the Revenue OS campaign send gates in `lib/revenue-os/email.ts`.

Required for a live send:

- `EMAIL_SENDING_ENABLED=true`
- `AWS_SES_REGION` (quantumreach.app is verified in `us-east-2`)
- `AWS_SES_ACCESS_KEY_ID` and `AWS_SES_SECRET_ACCESS_KEY`
- `TRANSACTIONAL_FROM_EMAIL` or `DEFAULT_FROM_DOMAIN` (from address becomes `noreply@${DEFAULT_FROM_DOMAIN}`)
- `APP_BASE_URL` set to the Preview (or production) origin so the link host is correct

Optional: `TRANSACTIONAL_REPLY_TO` (defaults to `support@quantumreach.app`).

`EMAIL_SANDBOX_MODE=true` does not block transactional setup mail. While the SES account is in sandbox, every recipient must be a verified SES identity. Production access is an ops request and is out of scope here.

When sending is disabled, confirmation keeps the on-page setup link (`DEFERRED_PREVIEW_LINK`). When sending is enabled but SES fails, confirmation also shows the on-page link (`FAILED`).

Paid Stripe Checkout (webhook or success-return reconcile) issues the setup token once. A later confirmation render reuses an unused `SENT` invite and does not send again. Resend on the confirmation page force-issues a new token and sends a new email.
