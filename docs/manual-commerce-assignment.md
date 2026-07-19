# Manual commerce assignment
Platform operators can assign an active persisted `CommerceProduct` from **Platform → Subscriptions** or a workspace detail page. The centralized service creates a `SaasSubscriptionItem` with a nullable Stripe item ID and a provenance source. It consolidates repeated manual assignments for the same workspace/product/source by increasing quantity, preserving an auditable record rather than creating duplicate contributors.

Manual sources (`MANUAL_OPERATOR`, `COMPLIMENTARY`, `MIGRATION`, `SYSTEM`) are not Stripe revenue. Stripe items are immutable in this workflow. Operators may deactivate manual items (historical rows are retained), and every assignment/update/deactivation writes an `AuditLog`.
