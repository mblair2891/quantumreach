# Phase 4 — Source-of-Truth Knowledge + Workflow Orchestration Foundation

## What changed

Phase 4 adds a governed knowledge foundation, manual outreach tracking, call/transcript workflow tracking, and source traceability for AI-generated analysis and deliverables.

## Creating knowledge documents

1. Open `/dashboard/knowledge`.
2. Select **Create document**.
3. Paste approved methodology text.
4. Set document type, authority level, priority, version, tags, and workflow stages.
5. Save the document. Chunks are regenerated deterministically.
6. Review the document and select **Approve / activate**.

Only `ACTIVE` documents are retrieved for production AI generation. `DRAFT` documents are visible to users but excluded unless a future test-mode flow explicitly opts in. `ARCHIVED` documents are never used.

## Hierarchy behavior

The prompt context builder composes:

1. System behavior rules.
2. Governing source-of-truth excerpts.
3. Workflow-specific knowledge excerpts.
4. CRM / lead / opportunity context.
5. Diagnostic transcript/context.
6. Prior reviewed analysis.
7. Required output schema.
8. Review and finalization rules.

Global system, product, and UX doctrine are ordered ahead of stage-specific framework chunks. Templates and training documents are constrained to matching generator/stage use.

## AI generation paths

The diagnostic analyzer, executive report generator, strategic roadmap generator, and proposal generator now request source-of-truth context before generation. When no active sources exist, generation may continue with base defaults but records a source coverage warning.

## Sources used

Generation records `KnowledgeDocumentUsage` rows for selected chunks. Detail pages show **Sources used** without exposing raw internal prompts.

## Workflow foundations

- Lead records now include safe source tracking fields.
- Outreach campaigns and manual lead outreach statuses are available.
- Call sessions can be manually created with pasted transcripts and converted into diagnostic sessions.

## Deferred automation

The following remain intentionally out of scope: LinkedIn scraping, automated lead scraping, live outbound email sequences, open/click tracking, reply parsing, Zoom/Google Meet APIs, recording ingestion, automatic transcription, PDF/DOCX parsing, external drive sync, embeddings, pgvector, public links, billing, e-signature, and client portals.

## Deployment

Schema changes are non-destructive. Apply them with:

```bash
npm run prisma:deploy
```

## Bulk TXT knowledge import

Phase 4 now includes a focused bulk import path at `/dashboard/knowledge/import` for approved `.txt` source-of-truth documents. The workflow is intentionally deterministic and does not use AI for file parsing or metadata suggestions.

Implemented behavior:
- The dashboard links to **Bulk import TXT** from `/dashboard/knowledge`.
- The client reads multiple `.txt` files locally, rejects unsupported extensions, enforces the configured file-count and per-file size limits, and builds a review preview before anything is persisted.
- The preview proposes a title, description, document type, authority level, priority, workflow stages, version, and status for each file.
- The default status is `DRAFT`; `ACTIVE` is only used if the reviewer explicitly selects it before import.
- The reviewer can edit each document's title, description, type, authority level, priority, workflow stages, version, status, and source filename, remove individual files, or clear the preview.
- The server action validates the submitted payload again, requires active workspace access, creates `KnowledgeDocument` rows in that workspace only, and regenerates `KnowledgeChunk` rows using the existing deterministic chunking path.
- Successful imports redirect back to `/dashboard/knowledge` with an import summary.

Current limitations:
- `.txt` is the only supported file type.
- PDF, DOCX, object storage, and AI-assisted metadata extraction remain intentionally deferred.
