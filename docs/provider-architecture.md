# Provider architecture

Existing adapters remain authoritative: OpenSRS-compatible registration/hosted mailbox interfaces, Cloudflare DNS reconciliation, and Amazon SES transport/SNS event ingestion. Hosting mailbox SMTP is not bulk transport. Provider actions require explicit flags plus health checks and are deferred when disabled. Subscribers remain legal registrants where appropriate; Quantum Reach manages technical configuration.

Preview never purchases domains, creates provider mailboxes, or sends SES campaign traffic. Persist simulations with `isSimulated`, source, and scenario identifier; never mix them with live metrics.
