# Domain reseller provider selection

Quantum Reach uses `lib/managed-domains/providers.ts` as the managed-domain provider abstraction. The selector currently supports:

- `DOMAIN_PROVIDER=opensrs`: OpenSRS Horizon test adapter for safe search, quote, status, and operator-approved test-registration workflows.
- `DOMAIN_PROVIDER=mock`: local/test mock adapter.
- unset provider: disabled adapter, which permits draft purchase requests but blocks registrar operations.

Live domain purchasing remains disabled unless a future production registrar adapter is explicitly implemented. `DOMAIN_PURCHASING_ENABLED=false` is the expected Preview setting for the OpenSRS Horizon adapter. Horizon test registration is available only through operator-only actions and only when `OPENSRS_ENVIRONMENT=horizon` and `OPENSRS_API_BASE_URL` points at `horizon.opensrs.net`.

The provider abstraction preserves the existing managed-domain inventory, workspace assignment, DNS scaffolding, SES readiness, warmup, reputation, send gates, and meeting workflows. Provider errors are converted to safe messages and must not include credentials, signed auth material, or full raw provider payloads.
