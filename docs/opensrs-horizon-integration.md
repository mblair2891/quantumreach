# OpenSRS Horizon integration

Quantum Reach supports an OpenSRS registrar adapter for the Horizon test environment only. It is intended for safe operator validation of managed-domain search, quote, and test-registration flows.

## Environment

Set these values in Preview or a local secret store; never commit real secrets:

- `DOMAIN_PROVIDER=opensrs`
- `DOMAIN_PURCHASING_ENABLED=false`
- `OPENSRS_ENVIRONMENT=horizon`
- `OPENSRS_USERNAME`
- `OPENSRS_API_KEY`
- `OPENSRS_API_BASE_URL=https://horizon.opensrs.net:55443`

The provider is ready only when the username, API key, Horizon environment, and Horizon base URL are present. Missing configuration returns a safe error that names missing variable names but never includes values.

## Authentication

OpenSRS Horizon requests are XML POSTs signed with the reseller API key. The adapter sends the username in `X-Username` and a derived MD5 signature in `X-Signature`. Credentials, signatures, and raw provider responses are not logged or persisted by the adapter.

## Supported test operations

- Domain availability lookup through Horizon.
- Domain quote lookup with provider price parsing when OpenSRS returns a price field.
- Horizon-only test registration after an operator-only purchase request path.
- Domain status lookup when the provider returns a status field.

## Safety gates

Production registration is blocked. The adapter rejects non-Horizon configuration and the admin UI labels all OpenSRS output as TEST. This pass does not add billing, charges, DNS automation, SES mutation, or production purchasing.
