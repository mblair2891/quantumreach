-- Phase 6: add analyzed status for call sessions after downstream diagnostic analysis.
ALTER TYPE "CallSessionStatus" ADD VALUE IF NOT EXISTS 'ANALYZED';
