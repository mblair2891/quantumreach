# Phase 8 — R2 Original File Storage and Knowledge Operations

Phase 8 stores original uploaded knowledge files in Cloudflare R2 while preserving the extracted source text already used by Quantum Reach deliverable generation.

## Storage behavior

- Supported upload formats remain `.txt`, `.md`, `.pdf`, and `.docx`.
- Preview extraction still happens through `/api/knowledge/import-preview`.
- Final import re-submits the original files to the server action so the server has source bytes at the moment the `KnowledgeDocument` is created.
- Each original file is stored under a workspace/document-scoped key:
  - `workspaces/{workspaceId}/knowledge-documents/{documentId}/original/{uuid}-{safeFileName}`
- `KnowledgeDocument.storageKey` stores the internal object key only.
- Normal UI does not display raw storage keys or public bucket URLs.
- If original-file storage fails during final import, the document import is stopped before creating partial records.

## Protected download behavior

Original files are downloaded through:

- `/api/knowledge/[id]/download-original`

The route verifies the active workspace, document ownership, and that the stored key belongs to that exact workspace/document path before streaming the file. The client never supplies a `storageKey` as authority.

## Version and replacement behavior

The import UI supports selecting an existing document as the superseded version. Replacement uploads create a new `KnowledgeDocument` record as `DRAFT` by default. Existing active versions are not overwritten, and historical Sources Used records continue to point to the original document/version.

## Cleanup behavior

Permanent deletion remains blocked for ACTIVE documents and for documents that have usage/source references. For unused DRAFT or ARCHIVED documents with `storageKey`, the R2 object must delete successfully before the database record is hard-deleted.

## Audit events

Phase 8 records safe audit events for original file storage, download, storage failures, storage deletion during hard delete, document version creation, and status changes. Audit metadata intentionally excludes signed URLs, credentials, and raw internal errors.

## Environment

The following placeholder-only variables are used by the server-side storage helper:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_ENDPOINT`
- `R2_PUBLIC_BASE_URL` (reserved if a deployment uses it elsewhere)

Deploy schema migrations with `npm run prisma:deploy` when migrations are present. Phase 8 uses existing Phase 5 schema columns and does not add a new migration.
