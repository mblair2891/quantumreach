# Phase 6 — Call Transcript Diagnostic Workflow

Phase 6 makes the calls workflow operational. Workspace members can create call sessions, link them to CRM context, paste or upload plain-text transcripts, create diagnostics from transcripts, run the existing source-of-truth guided analyzer, and return to the call to see linked downstream outputs.

## Implemented routes

- `/dashboard/calls` lists active-workspace call sessions with transcript readiness, diagnostic state, and latest analysis visibility.
- `/dashboard/calls/new` creates a new call session with provider, status, call date, URLs, optional transcript text or `.txt`/`.md` file, and workspace-scoped CRM selectors.
- `/dashboard/calls/[id]` shows and edits call metadata, manual status, CRM context, transcript review, diagnostic creation, linked outputs, and recent audit activity.

## Status workflow

Supported call statuses are:

- `SCHEDULED`
- `COMPLETED`
- `TRANSCRIPT_READY`
- `DIAGNOSTIC_CREATED`
- `ANALYZED`
- `ARCHIVED`

Saving transcript text from a scheduled or completed call advances the call to `TRANSCRIPT_READY`. Creating a diagnostic advances it to `DIAGNOSTIC_CREATED`. When a linked diagnostic has analysis, the detail page surfaces that analyzed state and updates the call to `ANALYZED` from `DIAGNOSTIC_CREATED`.

## Diagnostic creation

`createDiagnosticFromCallSession` requires an authenticated user with access to the active workspace, verifies the call belongs to that workspace, requires transcript text, reuses an existing linked diagnostic to prevent duplicates, copies transcript content into the diagnostic transcript table, and links the diagnostic to the call through `DiagnosticSession.callSessionId`.

## Source-of-truth continuity

The call workflow does not bypass or rewrite analyzer logic. Call-created diagnostics use the same diagnostic detail page and `Run Diagnostic Summary + Constraint Extraction` action as all other diagnostics, so Phase 4/5 active source-of-truth retrieval and Sources Used traceability continue to apply.

## Security and tenant isolation

All service entry points call `requireWorkspaceAccess(workspaceId)`. Call list/detail queries filter by `workspaceId`. CRM selectors only load records from the active workspace, and create/update services verify every linked lead, contact, company, and opportunity belongs to the same workspace before saving.

## Audit events

Phase 6 records audit events for call creation, metadata updates, transcript added/updated, status updates, CRM linking, and diagnostic creation from a call.

## Migration

A non-destructive migration adds the `ANALYZED` value to the `CallSessionStatus` enum.

Deployment command:

```bash
npm run prisma:deploy
```

## Deferred items

Automatic transcription, call provider APIs, audio/video upload, calendar scheduling, recording ingestion, and webhook processing remain out of scope.
