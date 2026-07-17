# OpenSRS Horizon integration

OpenSRS Horizon remains a test-only path. `OPENSRS_TEST_CONTACT_*`, `OPENSRS_REG_USERNAME`, and `OPENSRS_REG_PASSWORD` are only used for Horizon test registrations.

Production OpenSRS payloads must use the `DomainPurchaseRequest` registrant snapshot for `WORKSPACE_OWNED` domains. Quantum Reach service contact environment values may map to technical/admin/billing contacts and may be the registrant only for `QUANTUM_REACH_MANAGED` internal domains. Horizon test contact values must never be used as production registrant identity.
