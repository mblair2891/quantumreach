# Quantum Reach

Quantum Reach is an enterprise-grade, multi-tenant SaaS foundation for CRM-led decision intelligence: native CRM, structured diagnostics, AI orchestration, business analysis, ROI/cost-of-inaction modeling, executive reporting, strategic roadmaps, proposals, and implementation handoff.

**Completion classification for this build:** Built with limitations. The repository now contains the production-oriented MVP foundation, but it is not production-validated or deployment-smoke-tested until real provider credentials, migrations, and Vercel validation are completed.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS, shadcn-style UI primitives
- Prisma + PostgreSQL/Neon (`DATABASE_URL`, `DIRECT_DATABASE_URL`)
- Clerk authentication with internal workspace RBAC
- OpenAI provider abstraction with structured JSON output handling
- Cloudflare R2 private storage abstraction
- Trigger.dev-ready job abstraction
- Sentry configuration guarded by DSN presence
- Vercel deployment target

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Populate local-only values; do not commit secrets.
3. Install dependencies:

```bash
npm install
```

4. Generate Prisma client:

```bash
npm run prisma:generate
```

5. Create a Neon development database, ensure pgvector is enabled if you plan future vector features, then run:

```bash
npm run prisma:migrate -- --name init
```

6. Optional demo seed:

```bash
npm run prisma:seed
```

7. Start development:

```bash
npm run dev
```

## Clerk setup notes

Create a Clerk application, set the publishable and secret keys, and configure sign-in/sign-up URLs from `.env.example`. Clerk protects `/onboarding` and `/dashboard(.*)` through `middleware.ts`. Application permissions still use internal `WorkspaceMember.roleKey` and service-layer checks.

## Neon and Prisma notes

The Prisma schema defines workspace-scoped CRM, diagnostics, AI, reporting, proposal, delivery, knowledge, audit, role, and permission records. Use `DIRECT_DATABASE_URL` for migrations and `DATABASE_URL` for runtime pooling if Neon provides separate URLs.

## OpenAI notes

Set `OPENAI_API_KEY` and `OPENAI_DEFAULT_MODEL`. The OpenAI adapter lives behind `lib/ai/provider.ts`, while `lib/ai/orchestration.ts` records AnalyzerRun, AIExecution, and AIOutputArtifact rows. AI output is draft/reviewed/final governed and does not directly overwrite CRM records.

## R2 notes

R2 storage is private by default through `lib/storage/service.ts`. `R2_PUBLIC_BASE_URL` may remain blank. DocumentAsset records are ready for future file and transcript upload workflows.

## Trigger.dev notes

`lib/jobs/service.ts` provides the job queue seam. Full Trigger.dev task registration should be completed after project id/secret setup; missing `TRIGGER_PROJECT_ID` does not block local development.

## Sentry notes

Sentry initializes only when `NEXT_PUBLIC_SENTRY_DSN` is present. `SENTRY_AUTH_TOKEN` is optional and should be used for source map/release upload in CI, not required locally.

## Vercel deployment

Create a Vercel project named `quantumreach`, connect the GitHub repository, add all environment variables, and deploy `main`. Vercel production builds use the `vercel-build` npm script, which runs `prisma generate`, `prisma migrate deploy`, and then `next build` with the production environment variables configured in Vercel. This applies committed pending Prisma migrations before the application build completes without exposing `DATABASE_URL` or `DIRECT_DATABASE_URL` in logs.

Prisma migrations must be created and committed before deployment. Production deployments must only apply committed migrations with `prisma migrate deploy`; never use `prisma migrate dev` or `prisma db push` against production. Perform a production smoke test for auth, onboarding, dashboard protection, workspace isolation, and provider integrations after deployment.

## Validation commands

The repair pass targets these commands. If npm registry access is blocked in your environment, run them locally or in CI with registry access.


```bash
npm run prisma:generate
npm run typecheck
npm run lint
npm run test
npm run build
```

## Security posture

- No secrets are committed; `.env.example` uses placeholders only.
- Dashboard and onboarding routes are protected by Clerk middleware.
- Workspace-scoped service helpers enforce membership before queries/mutations.
- Business records include `workspaceId` and archive/status fields where appropriate.
- AI outputs are auditable and require human review before finalization.
- A dependency-free in-memory rate-limit helper protects the AI analyzer API during local/runtime MVP use; replace it with Upstash Redis, Vercel KV, or an edge-safe shared limiter before multi-instance production launch.

See `docs/architecture.md` and `docs/manual-test-checklist.md` for detailed architecture and manual validation steps.


## Private beta operations

Quantum Reach is configured as a Zoom-first private-beta SaaS workspace. The supported production meeting workflow is: create a Zoom meeting, start it from Quantum Reach, receive lifecycle updates through the Zoom webhook, end the meeting, upload the local recording, and let the transcript/analysis workflow continue. M4A local recordings are supported. Zoom cloud recording import code remains preserved, but cloud recording should be treated as operationally deferred unless the Zoom account plan includes cloud recording.

### Admin, operator, and health checks

Workspace owners and admins can use `/dashboard/settings`, `/dashboard/settings/domain-registrant`, `/dashboard/settings/integrations/meetings`, `/dashboard/admin`, and `/dashboard/billing` for setup and operational visibility. All workspace users can open `/dashboard/sending-domains` for domain readiness and managed-domain entry points. Platform operators are controlled by the comma-separated `ADMIN_EMAILS` environment variable and can use `/dashboard/operator` and `/dashboard/admin/domains` for safe summaries of workspaces, users, meeting status, failed webhook events, and failed transcription jobs. The public `/api/health` route returns only a minimal liveness response and does not expose secrets.

### Billing setup

Billing is feature-gated for private beta. Set `BILLING_ENABLED=false` unless Stripe is intentionally configured with `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and one or more `STRIPE_PRICE_ID_*` values. When billing is disabled or incomplete, checkout and portal routes return a safe disabled response and the rest of the app continues to run.

### Deployment and smoke tests

Before production launch, run the validation suite, verify Zoom OAuth and webhook configuration, confirm Cloudflare R2 CORS for browser uploads, upload a local Zoom M4A recording, confirm analysis handoff, and review `docs/private-beta-launch.md` for the full launch checklist and known limitations.

## Revenue OS Foundation

This repository includes the Quantum Reach Revenue OS foundation: CRM pipeline records, governed CSV imports, AWS SES-first email-provider abstraction, suppression/unsubscribe/bounce/complaint foundations, compliance-gated campaigns, native scheduling, disabled-by-default research provider abstraction, proposal-to-contract workflows, native e-signature audit artifacts, Stripe hard-gate helpers, client provisioning requests, and operator summaries.

Live email requires AWS SES configuration, DNS authentication, verified workspace sending domains, compliant campaigns, active billing where enabled, and `EMAIL_SENDING_ENABLED=true` with `EMAIL_SANDBOX_MODE=false`. Existing Zoom OAuth, Zoom-only meetings, webhook signature verification, local recording upload, M4A upload, and recording-to-analysis workflows remain supported.

## Managed domain provisioning foundation

Quantum Reach includes a safe managed sending-domain foundation for operator domain inventory, workspace assignments, DNS record readiness, AWS SES identity readiness, warmup limits, reputation snapshots, and campaign send-gate checks. Live domain purchasing, DNS automation, and live email sending are disabled by default and require explicit environment configuration. Domain warmup improves risk management but does not guarantee inbox placement; workspace-owned or dedicated domains are preferred over broad shared domains.

## Managed domain registrant ownership

Workspace-owned domain purchases require a complete, confirmed Domain Registrant Profile. The customer/workspace is normally the legal registrant, while Quantum Reach remains the OpenSRS reseller and manages DNS, SES, warmup, billing, and renewals. Quantum Reach-owned and shared-pool domains are separate ownership modes and must not imply customer ownership.

OpenSRS Horizon `OPENSRS_TEST_CONTACT_*` values are test-only. Production registration uses the immutable purchase registrant snapshot, with optional Quantum Reach service contact values for technical/admin/billing roles. Transfer-out support is currently a foundation workflow only; auth codes are not exposed.


## SaaS persona architecture

Quantum Reach is structured for four clearly separated experiences:

1. **Platform Operator** — `/platform/*` operator console for safe aggregate subscriber, workspace, domain, email, provisioning, webhook, audit, settings, and provider health administration.
2. **Subscriber** — `/dashboard/*` workspace operating system for CRM, outreach, meetings, delivery, knowledge, billing, integrations, and settings.
3. **Client** — `/portal/*` client-facing portal for linked projects, roadmaps, deliverables, meetings, documents, onboarding actions, and profile data only.
4. **Public Prospect** — public scheduling, signing, unsubscribe, pricing, signup, login, and onboarding routes outside the authenticated SaaS shells.

See `docs/saas-platform-architecture.md` and companion SaaS docs for routing, onboarding, roles, entitlements, branding, platform console, subscriber workspace, client portal, smoke tests, and known limitations.
