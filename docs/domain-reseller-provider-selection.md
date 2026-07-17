# Domain reseller/provider selection

Quantum Reach acts as reseller/service provider while the customer is generally registrant for `WORKSPACE_OWNED` domains. Provider adapters must support clear contact roles: registrant, admin, technical, and billing. Provider-specific registrant credentials must be generated per customer/order/account when needed; any stored registrar secrets must use existing encryption infrastructure and must never be logged or returned to UI.
