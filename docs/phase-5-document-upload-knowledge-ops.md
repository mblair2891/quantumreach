# Phase 5 — Document Upload, Parsing, and Knowledge Operations

Phase 5 expands the source-of-truth workflow from TXT-only bulk import to direct upload previews for TXT, Markdown, PDF, and DOCX files.

## Upload and parsing behavior

- Users upload files from `/dashboard/knowledge/import`.
- The browser performs lightweight extension and size checks for fast feedback.
- `/api/knowledge/import-preview` repeats server-side authentication, active workspace access, file count, file type, and size validation before text extraction.
- TXT and Markdown are decoded as UTF-8 text.
- DOCX extraction reads `word/document.xml` and converts document XML text nodes to plain text.
- PDF extraction supports selectable text strings. OCR is intentionally out of scope.
- Empty selectable PDF extraction returns the warning: “No selectable text was found. This may be a scanned document. OCR is not yet supported.”

## Import preview behavior

Each uploaded file becomes an editable preview before any `KnowledgeDocument` is created. The preview includes file name, detected file type, extraction status, character count, extraction warnings, source text preview, title, description, document type, authority level, priority, workflow stages, version, status, and optional version lineage.

Default status remains `DRAFT`. Documents become `ACTIVE` only when the user explicitly chooses `ACTIVE` in the preview.

## Original file storage

Original binary file storage is deferred. The current storage abstraction only defines a private R2 contract and intentionally does not perform stable uploads yet. Phase 5 stores extracted `sourceText`, `sourceFileName`, `sourceMimeType`, and `sourceFileSizeBytes`, with optional `storageKey` reserved for a future R2 implementation.

## Versioning

Users can mark an uploaded preview as a new version of an existing workspace document. This creates a separate draft `KnowledgeDocument` with `parentDocumentId` and `supersedesDocumentId`; the existing active document is not overwritten. Usage history continues to point to the exact document/version used at generation time.

## Deployment

This phase adds non-destructive Prisma columns and indexes. Deploy with:

```bash
npm run prisma:deploy
```
