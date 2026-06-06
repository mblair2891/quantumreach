# Source-of-Truth Classification

Quantum Reach Phase 4 introduces governed knowledge documents that are workspace-scoped and classified before AI generation may use them.

## Authority levels

Supported authority levels are: `SYSTEM_DOCTRINE`, `PRODUCT_DOCTRINE`, `UX_COPY_DOCTRINE`, `STRATEGY_FRAMEWORK`, `DIAGNOSTIC_FRAMEWORK`, `ROI_FRAMEWORK`, `REPORT_FRAMEWORK`, `ROADMAP_FRAMEWORK`, `PROPOSAL_FRAMEWORK`, `EXECUTION_HANDOFF`, `AUTHORITY_TEMPLATE`, `TRAINING_CURRICULUM`, `COURSE_TEMPLATE`, and `REFERENCE`.

## Priority model

Supported priorities are `GLOBAL`, `HIGH`, `MEDIUM`, and `LOW`.

Retrieval order favors global doctrine first, then workflow-stage matches, then generator-specific frameworks. Draft and archived documents are excluded from production prompt context.

## Initial 11-document manifest

1. Master System Operating Doctrine — `SYSTEM_DOCTRINE`, `GLOBAL`.
2. Master System Rollout Directive — Best-in-Class Expanded Edition — `PRODUCT_DOCTRINE`, `GLOBAL`.
3. Consulting-First Copy, UX, and Decision Architecture Standard — `UX_COPY_DOCTRINE`, `GLOBAL`.
4. Authority-Led Framework, Academy Positioning, and Operating Doctrine — `STRATEGY_FRAMEWORK`, `HIGH`.
5. Business Strategy, Scale, Integration & Exit Architecture — `STRATEGY_FRAMEWORK`, `HIGH`.
6. AI Solution Integration & Execution Handoff — `EXECUTION_HANDOFF`, `HIGH`.
7. Finesse IT Layer Master Prompt — `REPORT_FRAMEWORK` document type with `STRATEGY_FRAMEWORK` authority, `HIGH`.
8. 26-Week Master Curriculum Detailed Instructional Build — `TRAINING_CURRICULUM`, `MEDIUM`.
9. Mastery Template of Each Section of the Course — `COURSE_TEMPLATE`, `MEDIUM`.
10. Authority Figure Prompt for Any Niche — `AUTHORITY_TEMPLATE`, `MEDIUM`.
11. Any Niche Ultimate Authority Dominance Blueprint — `AUTHORITY_TEMPLATE`, `MEDIUM`.

No PDFs were present in the repository during this build, so Phase 4 provides a seedable metadata manifest and manual paste ingestion. To import source files, create a document in `/dashboard/knowledge/new`, paste approved text, assign authority/priority/stages, save, and activate after review.
