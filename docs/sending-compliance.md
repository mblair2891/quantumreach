# sending compliance

Quantum Reach now models managed sending infrastructure as a configurable SaaS product foundation. OpenSRS is the initial managed-domain provider. Mailbox hosting is abstracted and may use OpenSRS Email or another wholesale provider later; SES is only the initial bulk transport provider and does not represent the customer mailbox product. Pricing, Stripe mappings, wholesale costs, and commission rates are deferred/configurable. Provider secrets must stay in environment/secret storage and must not appear in documentation, logs, UI, or ordinary application records.

## Operational safety

- Subscriber surfaces use workspace-scoped data and never show wholesale cost or provider credentials.
- Platform surfaces can inspect operational readiness and wholesale domain cost where data exists.
- Real purchasing, mailbox provisioning, DNS automation, inbound sync, and outbound sending remain disabled unless the corresponding environment gates are enabled.
- Compliance gating blocks suppression, unsubscribe, complaint, unready sender, disabled sending, and sandbox conditions before provider calls.
