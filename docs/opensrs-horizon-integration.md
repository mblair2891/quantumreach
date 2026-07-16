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

Horizon test registration also requires registrant account credentials. These are distinct from the reseller API credentials above and are used only in the registration XML payload:

- `OPENSRS_REG_USERNAME`
- `OPENSRS_REG_PASSWORD`

The minimum Horizon test registration contact payload is environment-driven so production code does not hardcode personal data:

- `OPENSRS_TEST_CONTACT_FIRST_NAME`
- `OPENSRS_TEST_CONTACT_LAST_NAME`
- `OPENSRS_TEST_CONTACT_ORG`
- `OPENSRS_TEST_CONTACT_ADDRESS1`
- `OPENSRS_TEST_CONTACT_CITY`
- `OPENSRS_TEST_CONTACT_STATE`
- `OPENSRS_TEST_CONTACT_POSTAL_CODE`
- `OPENSRS_TEST_CONTACT_COUNTRY`
- `OPENSRS_TEST_CONTACT_PHONE`
- `OPENSRS_TEST_CONTACT_EMAIL`

The provider readiness check covers reseller API configuration and Horizon mode. Registration-specific validation runs immediately before `sw_register` and returns safe configuration errors when `OPENSRS_REG_USERNAME`, `OPENSRS_REG_PASSWORD`, or required test contact variables are missing.

## Authentication

OpenSRS Horizon requests are XML POSTs signed with the reseller API key. The adapter sends the reseller username in `X-Username` and a derived MD5 signature in `X-Signature`. Credentials, signatures, registrant passwords, and raw provider responses are not logged or persisted by the adapter.

## Registration payload

The Horizon-only `sw_register` request is generated deterministically with these attributes:

- `domain`
- `reg_type=new`
- `period=1`
- `reg_username`
- `reg_password`
- `auto_renew=0`
- `custom_nameservers=0`
- `custom_tech_contact=0`
- `contact_set.owner`
- `contact_set.admin`
- `contact_set.tech`
- `contact_set.billing`

All four contacts use the same operator-configured Horizon test contact values. Custom nameservers and custom technical contacts remain disabled for the test registration path.

## Supported test operations

- Domain availability lookup through Horizon.
- Domain quote lookup with provider price parsing when OpenSRS returns a price field.
- Horizon-only test registration after an operator-only purchase request path.
- Domain status lookup when the provider returns a status field.

## Safety gates

Production registration is blocked. The adapter rejects non-Horizon configuration and the admin UI labels all OpenSRS output as TEST. This pass does not add billing, charges, DNS automation, SES mutation, or production purchasing. `DOMAIN_PURCHASING_ENABLED=false` behavior for live registration remains unchanged; the Horizon registration action is operator-only and test-only.
