# Phase 2 CRM + Diagnostic Workflows

Phase 2 turns the foundation into an operational path from CRM record to diagnostic context to analyzer-generated intelligence.

## CRM workflows

- Companies, contacts, leads, and opportunities now have workspace-scoped list and detail pages under `/dashboard`.
- Records can be created from list pages, updated from detail pages, and archived instead of hard-deleted.
- Detail pages show overview data, related records, activity, diagnostics, and explicit actions.
- Service loaders always require an authenticated workspace member and query by both `id` and `workspaceId`.

## Activity workflows

- CRM detail pages support notes, tasks, and follow-ups.
- Activity records carry `workspaceId`, `relatedType`, `relatedId`, `createdById`, status where applicable, and timestamps.
- Timelines merge activities, notes, tasks, and follow-ups in reverse chronological order.

## Diagnostic workflows

- A diagnostic session can be started from any company, contact, lead, or opportunity detail page.
- Diagnostic sessions preserve CRM linkage through `relatedType` and `relatedId`, inherit `workspaceId`, and log audit activity.
- Diagnostic detail pages show linked CRM context and accept pasted transcript, discovery notes, and business context.
- Saving transcript/context creates a transcript record and moves the session to `TRANSCRIPT_READY`.

## Analyzer workflow

The first functional analyzer is **Diagnostic Summary + Constraint Extraction**. It creates an analyzer run and AI execution, calls the OpenAI provider abstraction, stores raw and structured output, creates an AI output artifact, and creates or updates the linked analysis record.

Structured outputs include:

- Summary
- Constraints
- Bottlenecks
- Recommendations
- Risks
- Assumptions

Outputs are marked `NEEDS_REVIEW`. If parsing fails, raw output and the parse error are preserved in the execution/artifact so the user can review safely.

## Tenant isolation

Tests cover workspace-scoped CRM detail loading, cross-workspace not-found behavior, archive/update scoping, activity scoping, diagnostic creation scoping, and analyzer session scoping.

## Migration

Migration `20260604120000_phase_2_transcript_context` adds optional transcript context fields:

- `Transcript.discoveryNotes`
- `Transcript.businessContext`

Apply with the existing non-destructive Prisma deploy command in shared environments:

```bash
npm run prisma:deploy
```
