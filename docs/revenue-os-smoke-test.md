# Revenue OS Smoke Test

1. Confirm Zoom OAuth, Zoom-only runtime, webhook timestamp signature tests, local recording upload, M4A upload, and recording-to-analysis handoff still pass.
2. Preview a CSV import with valid, invalid, duplicate, and suppressed rows.
3. Attest and commit valid contacts.
4. Create a sending domain/sender identity; keep live sending disabled until SES DNS is verified.
5. Build a campaign and confirm compliance gates block missing address/unsubscribe/suppressed recipients.
6. Create a scheduling page and public booking.
7. Generate interview questions.
8. Create proposal, accept it, generate contract, sign with token, and confirm provisioning request.
9. Enable billing in staging and verify non-admin user is gated while ADMIN_EMAILS bypass works.
