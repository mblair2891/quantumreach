# Workspace entitlement resolution
An item contributes only when its product is active, its status is `ACTIVE` or `TRIALING`, quantity is positive, `startsAt` is absent/past, and `endsAt` is absent/future. Persisted product entitlement values are multiplied by quantity and summed; boolean values are ORed; active infrastructure overrides are applied last. Stripe item IDs are used as stable deduplication keys.

Core is required before ordinary upgrades, packages, and add-ons. Only one active `SENDING_PACKAGE` may exist; operators must deactivate it before replacing it. Add-ons may coexist.
