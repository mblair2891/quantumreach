# Contact Import Compliance

Users are responsible for importing contacts they have lawful authority to contact. Quantum Reach runs contact hygiene on ingest (CSV, forms, and optional webhooks): emails are trimmed and lowercased, syntax-checked, names are trimmed (title-cased on CSV), company emoji is stripped and flagged, and rows are deduped by workspace+email with merged source history.

CRM stores `hygieneStatus` (`ready`, `needs_review`, `invalid`, `suppressed`) plus `hygieneFlags`. Domain mismatch (email domain differs from `companyDomain`) is `needs_review`, never silent ready. Import preview shows ready / review / invalid counts, sample flagged rows, import-ready-only, and export of rejects. Campaigns default to `status=ready` only and cannot start with zero ready contacts. Needs-review and invalid contacts are never auto-enrolled.
