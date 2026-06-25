# Known Limitations

- Production email worker and real AWS SES transport are deferred; disabled/sandbox mode never sends live email.
- SES SNS signature verification should be completed before enabling provider webhooks.
- Signed PDF rendering is represented by HTML snapshot/audit certificate artifacts and needs a PDF renderer before legal production use.
- Calendar-provider conflict checks are deferred; scheduling uses internal booking conflicts only.
- Live research provider integration is abstracted but not wired to a vendor.
- Client workspace provisioning is request/approval foundation first, not automatic data migration.

## Managed domain provisioning limitations

The managed-domain module is a safe foundation. Registrar purchasing, Cloudflare mutation, AWS SES mutation, Stripe charges, and artificial warmup sending are intentionally disabled unless explicitly configured in a future operator-approved flow. The dashboard reports deliverability health signals only and does not guarantee inbox placement.
