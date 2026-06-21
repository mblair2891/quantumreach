# Known Limitations

- Production email worker and real AWS SES transport are deferred; disabled/sandbox mode never sends live email.
- SES SNS signature verification should be completed before enabling provider webhooks.
- Signed PDF rendering is represented by HTML snapshot/audit certificate artifacts and needs a PDF renderer before legal production use.
- Calendar-provider conflict checks are deferred; scheduling uses internal booking conflicts only.
- Live research provider integration is abstracted but not wired to a vendor.
- Client workspace provisioning is request/approval foundation first, not automatic data migration.
