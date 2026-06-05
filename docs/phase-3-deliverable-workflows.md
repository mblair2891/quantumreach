# Phase 3 Deliverable Workflows

Phase 3 expands Quantum Reach from diagnostic analysis into reviewed, executive-ready business deliverables.

## Human review and finalized analysis

Analyzer output remains draft intelligence in `NEEDS_REVIEW` until a workspace member edits and explicitly reviews, finalizes, or rejects the analysis. The analysis detail route supports editable summary, constraints, bottlenecks, recommendations, risks, assumptions, executive notes, and internal notes. Raw analyzer output remains preserved in AI execution artifacts and the stored analysis observation payload.

## Deliverable generation gates

Executive reports, strategic roadmaps, and proposal drafts can only be generated from analysis records with `REVIEWED` or `FINAL` status. Generated reports and roadmaps are kept in `GENERATED` status, while proposal drafts remain `DRAFT` until a user manually reviews or finalizes them.

## Business-case expansion

Analysis records can maintain editable ROI and cost-of-inaction models, including estimated upside, implementation cost, cost of delay, time horizon, confidence score, and reviewed assumptions. The analysis, report, roadmap, and proposal detail pages render these values in a readable business-case summary.

## Tenant isolation

All Phase 3 service methods require workspace access before loading or mutating records, and all record lookups include `workspaceId` with the user-supplied record id. Cross-workspace records resolve as not found rather than exposing record existence.

## Migration

Schema changes are captured in `prisma/migrations/20260605090000_phase_3_deliverable_workflows/migration.sql` and can be applied with the existing non-destructive deploy path:

```bash
npm run prisma:deploy
```
