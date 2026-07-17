# Known limitations

Live transfer-out is not implemented. Transfer readiness fields (`transferEligibleAt`, `transferRequestedAt`, `transferStatus`, `registrarLockStatus`, `authCodeStatus`) are present so future operations can support customer exits according to registrar/TLD rules without exposing auth codes.

Production registrar registration remains gated by provider configuration, billing/authorization, and `DOMAIN_PURCHASING_ENABLED=true`. Horizon contact environment variables are test-only and unsuitable for production ownership.
