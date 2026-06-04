-- Phase 2 diagnostic transcript context support.
ALTER TABLE "Transcript" ADD COLUMN "discoveryNotes" TEXT;
ALTER TABLE "Transcript" ADD COLUMN "businessContext" TEXT;
