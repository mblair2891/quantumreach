# Customer golden path

## Purpose and boundaries

The subscriber workspace (`/dashboard`) orchestrates existing CRM, outreach, meetings, analysis, proposal, contract, and delivery records. The operator console (`/platform`) and limited client portal (`/portal`) remain separate. The dashboard's **Your next best action** is deterministic: it inspects tenant-scoped persisted records, selects the earliest unmet prerequisite, and links to the existing module.

The optional scenario uses fictional agency owner Alex Morgan of Northstar Growth and fictional prospect Summit Dental Group / Dr. Maya Chen. All addresses use the reserved `.example` domain. A subscriber must explicitly select **Create example prospect**. The action is idempotent while its active opportunity exists and creates no provider call, send usage, signature, meeting, or payment claim.

Scenario records are labeled by the activity type `SIMULATION_SCENARIO_CREATED` and identifier `SUMMIT_DENTAL_GUIDED_JOURNEY`. Archive the example opportunity and associated CRM records to reset it; selecting the action afterward starts a new scenario. Provider-dependent actions must use their existing live integrations or be recorded as clearly labeled simulations in the corresponding module.

## Routes and provider boundaries

| Area | Subscriber route | Safe-mode boundary |
| --- | --- | --- |
| Home and guidance | `/dashboard` | Reads persisted state only |
| CRM | `/dashboard/crm`, `/dashboard/opportunities/[id]` | Example creation writes company, contact, lead, opportunity, note, and activity only |
| Research | `/dashboard/research` | Manual/provider fallback remains explicit |
| Outreach | `/dashboard/outreach` | Approval and infrastructure readiness remain required for live sending |
| Meetings | `/dashboard/meetings` | Manual notes/upload do not require Zoom |
| Analysis | `/dashboard/analysis` | Draft/review states remain distinct |
| Proposal/agreement | `/dashboard/proposals`, `/dashboard/contracts` | Simulation must not claim external delivery or legal e-signature |
| Delivery | `/dashboard/projects`, `/dashboard/deliverables` | Won conversion reuses the existing client and project models |
| Client portal | `/portal` | Existing authenticated client-role scope applies |

No additional environment variables are required for the resolver or example prospect. Live AI, email, Zoom, recording storage, signature, and commerce behavior retains the provider configuration documented in `.env.example` and the provider-specific guides.

## Automated validation

Run `npm test -- tests/customer-guided-journey.test.ts`, followed by the full commands in the README validation section. The focused test checks deterministic ordering, progression, onboarding guidance, and the canonical scenario identifier. Database-backed validation requires the repository's genuine configured database; do not substitute a fake URL.

## Exact manual customer golden-path smoke test

1. Sign in as a normal subscriber.
2. Open `/dashboard`.
3. Complete onboarding.
4. Confirm the next best action recommends adding a prospect.
5. Select “Create example prospect.”
6. Open Summit Dental Group.
7. Complete or generate example research.
8. Qualify the opportunity.
9. Generate outreach.
10. Approve outreach.
11. Run guided simulation.
12. Confirm a simulated reply.
13. Schedule a discovery meeting.
14. Complete the simulated meeting.
15. Review transcript and notes.
16. Generate analysis.
17. Edit and approve analysis.
18. Create proposal.
19. Preview proposal.
20. Simulate proposal acceptance.
21. Create contract.
22. Simulate agreement completion.
23. Mark opportunity won.
24. Confirm client conversion.
25. Open client onboarding.
26. Complete onboarding checklist items.
27. Generate delivery project.
28. Submit first deliverable.
29. Simulate client approval.
30. Confirm dashboard, tasks, pipeline, revenue, and next-action updates.
31. Confirm no records appear in another workspace.
32. Delete or reset the example scenario.
33. Confirm the system remains usable with manually created data.

## Known limitations

The guided service now persists every example transition through first deliverable approval, but this environment did not provide a genuine non-production database or authenticated subscriber session for the full manual smoke test. The service contract tests verify transition coverage and provider boundaries statically; database-backed idempotency, cross-workspace denial, responsive rendering, deployment, provider delivery, payment, and legal enforceability still require environment-specific validation.

## Persisted guided transitions

The Summit Dental opportunity page exposes one prerequisite-checked action at a time. Repeating a completed action is safe because progression is derived from persisted `GUIDED_*` activity markers. The sequence writes the following existing records:

1. `ResearchRun` with separated facts, assumptions, and discovery questions.
2. `Lead` score plus an opportunity `Note` containing the deterministic 78/100 qualification breakdown.
3. `OutreachCampaign`, three `OutreachStep` records, and `LeadOutreachStatus`; approval is a separate action.
4. A blocked `EmailSend` and `EmailEvent` explicitly stating that no delivery/provider call occurred.
5. A simulated inbound `CommunicationLog` and pending notification intent; no transactional email is marked sent.
6. An internal `CallSession`, followed separately by a simulated transcript, `DiagnosticSession`, and `Transcript`.
7. Editable `AnalysisRecord`, followed by explicit review approval.
8. Editable `Proposal`, simulated share/view, and explicit simulated acceptance.
9. `Contract` with a non-legal-signature notice, followed by simulated send/view/signature events in its content.
10. Explicit won status and retry-safe reuse of the existing client/project conversion service.
11. Eleven onboarding `ProjectTask` records and a requested four-phase `ProjectMilestone`/`ProjectTask` plan.
12. An `ExecutiveReport` used as the closest existing deliverable artifact, followed by explicit simulated client approval.

All scenario records retain proposed setup/monthly values separately from invoice, payment, and collected-revenue state. The dashboard includes simulated replies and uses scenario events to prevent completed meeting or proposal transitions from moving the recommendation backward.

## Reset

The opportunity page requires an explicit confirmation checkbox. Reset derives the scenario from the authenticated workspace, deletes only related scenario artifacts in dependency-safe order, leaves provider and usage records untouched, and appends a workspace audit event. Reset is repeat-safe from the UI: after reset, the user returns to the dashboard and may explicitly create a new example prospect.

## Focused testing

Run `npm test -- --run tests/customer-guided-journey.test.ts tests/customer-guided-scenario-service.test.ts`. The service contract suite covers all transition branches, ordering, simulation markers, provider non-invocation, workspace scoping, reset, and non-mutation of Stripe/usage records. Full database execution still requires genuine non-production `DATABASE_URL` and `DIRECT_DATABASE_URL` values.
