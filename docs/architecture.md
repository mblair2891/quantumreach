# Quantum Reach Architecture

Quantum Reach is initialized as a modular monolith designed to evolve toward service-oriented boundaries without making the CRM depend on any external CRM provider.

## Boundaries

- `lib/auth`: Clerk identity linkage, internal workspace membership, and RBAC helpers.
- `lib/workspaces`: onboarding, workspace selection, and member-scoped workspace lookup.
- `lib/crm`: native accounts, contacts, leads, opportunities, pipelines, tasks, notes, activities, reminders, and CRM-safe mutation services.
- `lib/diagnostics`: diagnostic sessions, transcript/context records, and CRM-linked discovery workflows.
- `lib/ai`: provider abstraction, OpenAI adapter, analyzer runs, AI executions, artifacts, and review states.
- `lib/reports`, `lib/roi`, `lib/proposals`, `lib/projects`: records and workflows for executive outputs and implementation handoff.
- `lib/storage`: private Cloudflare R2 abstraction for future documents and transcript uploads.
- `lib/jobs`: Trigger.dev-ready job boundary that does not block local development when project setup is incomplete.
- `lib/audit`: workspace-scoped audit logging.

## Tenant isolation

Every business record includes `workspaceId` where appropriate. Application services call `requireWorkspaceAccess(workspaceId)` before queries and mutations, and critical lookup paths must filter by both `id` and `workspaceId`.

## AI governance

AI execution is structured around AnalyzerDefinition, AnalyzerRun, AIExecution, and AIOutputArtifact records. AI outputs are stored as draft/needs-review/final artifacts and must not mutate CRM records without explicit user action.

## pgvector note

Neon can have pgvector enabled for future embedding search. The MVP stores a lightweight `embeddingRef` on knowledge records and avoids overbuilding vector search until retrieval requirements are validated.

## Rate limiting

`lib/rate-limit.ts` provides a small dependency-free in-memory limiter for safe MVP boundaries such as AI analyzer routes. Production deployments with multiple Vercel instances should replace this with a shared store such as Upstash Redis or Vercel KV.
