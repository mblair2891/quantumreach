# Domain registrant ownership

For `WORKSPACE_OWNED` managed domains, the workspace/customer is normally the legal registrant and Quantum Reach is the reseller and infrastructure manager. Workspace admins must enter accurate legal registrant name, organization when applicable, mailing address, phone, email, registrant type, and explicitly confirm accuracy before a production purchase request can be created.

`QUANTUM_REACH_MANAGED` domains are Quantum Reach-owned domains that a customer may lease/use. `SHARED_POOL` domains are Quantum Reach-owned shared infrastructure and must not be described as customer-owned.

Purchase requests preserve an immutable registrant snapshot so later profile edits do not rewrite historical ownership data. Future transfer-out operations will use transfer readiness status fields without exposing auth codes in UI.
