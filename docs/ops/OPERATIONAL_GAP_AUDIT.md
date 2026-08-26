# Quantum Reach — operational gap audit

**Branch audited:** `private-beta/commercial-lifecycle-hardening` (working tree, 2026-08-26)  
**Method:** live files, routes, Prisma models, env flags, and tests. Prior chat prompts that did not land in the repo are marked **MISSING**.  
**Hygiene note:** contact hygiene (`lib/contacts/`, import UI, campaign ready-only gate) exists in the **uncommitted working tree** on this branch. It is **not** on `origin` yet. Treat as PARTIAL until committed, migrated, and deployed.

Statuses: **DONE** (ships and matches the product definition) · **PARTIAL** (real code, incomplete or wrong stack) · **MISSING** (not in repo) · **N/A**.

---

## 1. Executive summary

**Can we run private beta this week?** **Yes for pay-first SaaS onboarding on Stripe TEST; no for Instantly/Smartlead-like outbound as a complete product.**

A guest can select Launch / Growth / Scale, pay (Stripe TEST or Preview simulated payment), receive a setup path, and claim a workspace. That golden path is implemented and tested. It does **not** require live campaign sending.

**Blockers to call the system 100% operational** (private beta → production):

| Blocker | Why it matters |
| --- | --- |
| Transactional mail was SES-only | **SMTP added** (`EMAIL_TRANSPORT=smtp`, `lib/email/transactional.ts`). SES sandbox does **not** block onboarding: set SMTP **or** the confirmation page still shows the fallback setup link (`DEFERRED_PREVIEW_LINK` / `FAILED`). |
| Two outbound stacks | Instantly-style Google/stub path (`lib/outbound`) vs SES managed-mailbox path (`lib/sending-infrastructure`). Docs (`docs/ops-sending-readiness.md`) still describe SES as customer outbound Path A. Risk of shipping the wrong send path. |
| Instantly campaigns are one-step, manual batch, no unsub/footer | No multi-step sequences, no stop-on-reply, no unibox, no public unsub on this path, no worker. `MANAGED_SENDING_ENABLED` defaults `false`. |
| Inbox warm-up not wired to Instantly `Inbox` | Warm-up exists for `ManagedMailbox` / SES, not for `Inbox.dailyLimit` (hard-coded 30). |
| Hygiene not shipped | Working-tree only. Without it, Instantly lists can enroll CSV mud. |
| Stripe Connect, Google Workspace reseller | Not in repo. Correctly later; do not block checkout beta. |
| `.env.example` duplicates / conflicts | `AWS_SES_REGION` appears as `us-east-2` then later `us-west-2`. Duplicate purchasing/sending flags. Ops foot-gun. |

**Do not wait on Connect, OpenSRS live purchase, or Google Workspace reseller to start a checkout-only private beta.** Do wait on a **single outbound architecture decision** (Google Instantly path is the product definition) plus transactional-mail fallback before promising “email always arrives.”

---

## 2. Area table

| Area | Status | Evidence | Gap |
| --- | --- | --- | --- |
| **A. Auth & account setup** | **DONE** (email transport PARTIAL) | See §A | SMTP fallback missing; SES sandbox can fail send |
| **B. Email transports** | **PARTIAL** | See §B | SES-only transactional; campaign SES stack still present; Instantly path does not use it |
| **C. Stripe SaaS billing** | **DONE** for TEST checkout | See §C | Live keys are ops, not code. `BILLING_ENABLED` default `false` |
| **D. Workspace & entitlements** | **PARTIAL** | See §D | Caps exist. PAST_DUE drops item status but Instantly `canSend` does not check subscription |
| **E. Outbound core** | **PARTIAL** | See §E | Limits + Google OAuth + one-step campaigns. Missing sequences, unibox, stop-on-reply, worker, Instantly warmup |
| **F. CRM / hygiene** | **PARTIAL** | See §F | CSV + CRM + scheduler exist. Hygiene in working tree only. No PPC/webhook HTTP ingest |
| **G. Compliance** | **PARTIAL** | See §G | Revenue-OS campaigns have unsub + physical address. Instantly campaigns do not |
| **H. Stripe Connect** | **MISSING** | No `CONNECT_ENABLED`; payouts page says no Connect | Later |
| **I. Domains wholesale** | **PARTIAL** | OpenSRS + Cloudflare gated | Not sending-domain-only in Instantly UI; Path B is managed domains |
| **J. Ops / prod readiness** | **PARTIAL** | Platform console exists; env example messy; stub ModulePages | Dual-stack docs; Clerk leftover in launch doc |

---

## A. Auth & account setup — **DONE** (mail PARTIAL)

| Check | Status | Evidence |
| --- | --- | --- |
| Guest order → PAID → `issueAccountSetupToken` | **DONE** | `lib/stripe/webhooks.ts` `syncPaid` → `verifyStripePayment` then `issueAccountSetupToken`. Also `lib/auth/account-setup.ts`. Tests: `tests/stripe-commerce.test.ts`, `tests/account-setup-email.test.ts` |
| `/setup/account?token=` claim, single-use, TTL | **DONE** | `app/setup/account/page.tsx`; TTL `ACCOUNT_SETUP_TOKEN_TTL_HOURS = 48` in `lib/auth/constants.ts`; used-at invalidation in `issueAccountSetupToken` |
| Confirmation: email-first vs fallback link; resend | **DONE** | `confirmationSetupInvitePresentation` — SENT hides on-page link; else shows it. `resendAccountSetupEmailAction` in `app/setup/confirmation/actions.ts` |
| Email delivery statuses | **DONE** | `SENT` / `DEFERRED_PREVIEW_LINK` / `FAILED` on `AccountSetupToken.emailDelivery` (`prisma/schema.prisma` ~4161). Disabled sending → `DEFERRED_PREVIEW_LINK` |

Better Auth is primary (`lib/auth/better-auth.ts`). Public signup is off unless `BETTER_AUTH_PUBLIC_SIGNUP_ENABLED=true` (`.env.example`).

**Gap:** SES sandbox does not block onboarding: `EMAIL_TRANSPORT=smtp` with Private Email (or other SMTP) **or** the confirmation fallback link (`DEFERRED_PREVIEW_LINK` / `FAILED`). Instantly/outbound never uses this transport.

---

## B. Email transports — **PARTIAL**

| Check | Status | Evidence |
| --- | --- | --- |
| SES helper | **PARTIAL** | Live send: `lib/email/transactional.ts` (account setup). Campaign SES: `lib/sending-infrastructure/ses.ts` (`AwsSesTransport.sendEmail` returns `AWS_SDK_RUNTIME_DEFERRED` / sandbox / disabled). `lib/revenue-os/email.ts` `AwsSesProvider.send` is intentionally deferred |
| SMTP / Private Email | **DONE** (transactional only) | `EMAIL_TRANSPORT=ses\|smtp` (default ses). SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`. `lib/email/smtp-transport.ts`. Campaigns must not import this. |
| Flags | **DONE** (defined) | `EMAIL_SENDING_ENABLED`, `EMAIL_SANDBOX_MODE`, `TRANSACTIONAL_FROM_EMAIL`, `TRANSACTIONAL_REPLY_TO` in `.env.example` |
| Campaign path cannot use transactional transport | **PARTIAL** | Instantly path: `lib/outbound/providers.ts` Stub or `GoogleOutboundProvider` — **no SES**. Legacy path: `lib/sending-infrastructure/campaign-service.ts` `processQueuedEmailSend` constructs `new AwsSesTransport()`. Job `CAMPAIGN_SEND_BATCH` in `lib/jobs/service.ts` still calls that |

**Product definition:** platform SES/Private Email never for subscriber campaigns. Instantly Google path matches. SES campaign stack is still in the job runner and in `docs/ops-sending-readiness.md` (“customer outbound uses workspace sender identities” + SES verify). **Do not enable `CAMPAIGN_SEND_BATCH` / SES campaign send.**

---

## C. Stripe SaaS billing — **DONE** (ops-gated)

| Check | Status | Evidence |
| --- | --- | --- |
| Checkout success/cancel via `APP_BASE_URL` | **DONE** | `lib/stripe/commerce.ts` `success_url` / `cancel_url` → `/setup/confirmation?orderId=…&checkout=success\|cancelled` |
| Webhooks idempotent | **DONE** | `StripeWebhookEvent` unique `stripeEventId`; skip if `PROCESSED` (`lib/stripe/webhooks.ts`) |
| Price IDs → package entitlements | **DONE** | `.env.example` `STRIPE_PRICE_LAUNCH_SENDER_PACKAGE` etc.; `lib/stripe/prices.ts` + `lib/sending-infrastructure/catalog.ts` |
| Customer portal | **DONE** | `createPortal` in `lib/stripe/commerce.ts`; `app/api/billing/portal/route.ts` |
| TEST vs live discipline | **PARTIAL** | Docs `docs/stripe-commerce.md` describe TEST card `4242…`. No code that refuses `sk_live` on Preview. Simulated payments blocked in production (`lib/simulated-payment/environment.ts`) |
| `BILLING_ENABLED` | **DONE** (safe default) | Default `false`. Checkout/portal return 503 via `requireBillingConfigured()` (`lib/billing/config.ts`) |

Tests: `tests/stripe-commerce.test.ts`, `tests/pay-first-setup.test.ts`, `tests/simulated-payment-environment.test.ts`.

**Ops to run TEST this week:** set `BILLING_ENABLED=true`, Stripe **test** secret + webhook + publishable key, and Price IDs for Core + Launch/Growth/Scale + setup. Keep live keys off Preview.

---

## D. Workspace & entitlements — **PARTIAL**

| Check | Status | Evidence |
| --- | --- | --- |
| Launch/Growth/Scale `maxSendingDomains` / `maxInboxes` | **DONE** | Catalog: Launch 2/6, Growth 5/15, Scale 10/30 (`lib/sending-infrastructure/catalog.ts`). Mapped in `lib/outbound/config.ts` `sendingPackageLimits`. Enforced in `addSendingDomain` / `addInbox` |
| Core domain `NONE` \| `BYO` \| `MANAGED_ADDON` | **DONE** | `lib/workspaces/core-domain.ts`; `saveWorkspaceCoreDomain` must not create ManagedDomain/DNS/SES/transfer. Instantly `addSendingDomain` / `addInbox` reject core BYO hostname |
| Cancel / past_due freeze | **PARTIAL** | Webhook maps Stripe `past_due`/`canceled` onto `SaasSubscription` + items (`lib/stripe/webhooks.ts` `syncSubscription`). `getWorkspaceEffectiveEntitlements` only counts `ACTIVE`/`TRIALING` items → **new** domains/inboxes fail allowance. Instantly `canSend` / `startOutreachCampaign` **do not** read subscription status — existing inboxes can still send |

---

## E. Outbound core — **PARTIAL**

There are **two** engines. Product definition is Instantly-like Google send.

### Instantly-style (intended)

| Piece | Status | Evidence |
| --- | --- | --- |
| Models `SendingDomain`, `Inbox`, `SendLog`, `OutboundList`, `OutboundCampaign`, `OutboundCampaignJob` | **DONE** | `prisma/schema.prisma`; migrations `20260818020000_outbound_inboxes_send_log`, `20260819000000_outbound_campaigns`, `20260819020000_inbox_google_oauth` |
| 3 inboxes / sending domain | **DONE** | `INBOXES_PER_DOMAIN = 3` (`lib/outbound/config.ts`) |
| 30 cold sends / inbox / day | **DONE** (no ramp) | `DEFAULT_INBOX_DAILY_LIMIT = 30`; `Inbox.dailyLimit` default 30 |
| Domain cap `min(100, inboxes × 30)` | **DONE** | `domainDailyLimit()` |
| `canSend` / `recordSend` | **DONE** | `lib/outbound/service.ts`; tests `tests/outbound-limits.test.ts` |
| Inbox rotation | **DONE** | `pickEligibleInbox` in `lib/outbound/campaigns.ts`; tests `tests/outbound-campaigns.test.ts` |
| Google OAuth send | **DONE** (gated) | `lib/outbound/google-oauth.ts`, `GoogleOutboundProvider`; routes `app/api/integrations/google/{connect,callback,disconnect}/route.ts`. Requires `GOOGLE_CLIENT_ID` / `SECRET` and `MANAGED_SENDING_ENABLED=true` |
| Stub provider when Google off | **DONE** | `StubOutboundProvider` — no SES |
| Warm-up ramp on new Instantly inboxes/domains | **MISSING** | No warmup fields on `Inbox` / `SendingDomain`. New inbox is immediately 30/day |
| Multi-step sequences | **MISSING** on this path | `OutboundCampaign` is one subject/body. `/dashboard/email-sequences` is a **ModulePage stub** |
| Stop-on-reply | **MISSING** | Not found in `lib/outbound` |
| Unibox | **MISSING** | `InboundEmailMessage` exists for managed mailboxes; `INBOUND_EMAIL_SYNC_ENABLED` defaults false; `REPLY_SYNC` job throws “requires a configured provider adapter” (`lib/jobs/service.ts`) |
| Campaign worker | **MISSING** | `processCampaignBatch` is UI “Process batch” only (`app/dashboard/sending/outbound/campaigns/actions.ts`). Hourly cron does **not** call it |
| Feature gate | **DONE** | `MANAGED_SENDING_ENABLED` (`lib/sending-infrastructure/gates.ts`) |

### Legacy SES / managed-mailbox (do not use for subscriber cold)

| Piece | Status | Evidence |
| --- | --- | --- |
| `ManagedDomain`, `ManagedMailbox`, `MailboxWarmupProfile`, `EmailCampaign`, `EmailSend` | Present | Schema + `lib/sending-infrastructure/*` |
| Warm-up worker | **DONE** on this stack | `runMailboxWarmupEvaluation`, cron `WARMUP_SWEEP` |
| Campaign send job | **PARTIAL / deferred** | `processQueuedEmailSend` → `AwsSesTransport` |
| Docs still sell this as Path A | Conflict | `docs/ops-sending-readiness.md` |

---

## F. CRM / hygiene — **PARTIAL**

| Check | Status | Evidence |
| --- | --- | --- |
| CSV import mapping + attestation | **PARTIAL** | Revenue-OS: `lib/revenue-os/imports.ts` (attestation required). Instantly UI now redirects to import preview (`app/dashboard/sending/outbound/actions.ts`) in working tree. `/dashboard/imports` was a stub; working tree replaces it |
| Hygiene: normalize, syntax, names, emoji, dedupe, domain mismatch | **PARTIAL (working tree)** | `lib/contacts/hygiene.ts`, `lib/contacts/ingest.ts`, migration `prisma/migrations/20260826000000_contact_hygiene/`. Tests: `tests/contact-hygiene.test.ts`, `tests/contact-import-hygiene.test.ts`. **Uncommitted** vs `origin` |
| Campaign audience `ready` only | **PARTIAL (working tree)** | `startOutreachCampaign` throws if zero ready; skips `NEEDS_REVIEW` / `INVALID` / duplicate email |
| Source: import | **PARTIAL** | CSV via imports / outbound |
| Source: form | **PARTIAL** | Scheduling `createPublicBooking` → `ingestContactRecord` `FORM_SCHEDULER` (working tree). Not a PPC form builder |
| Source: PPC | **MISSING** | No subscriber-facing lead-form / ads webhook. QR’s own `/start` funnel is **platform** acquisition, not workspace CRM ingest |
| Source: webhook / API | **MISSING** as HTTP | `ingestWebhookContact` exists in working tree; **no** `app/api/...` route. CRM POST `app/api/crm/contacts/route.ts` is authenticated create |
| Suppression on send | **DONE** | Instantly `recordSend` / start skip suppressed. Revenue-OS `isSuppressed` |

CRM archive `Contact.status` remains `ACTIVE`/`ARCHIVED`. Campaign eligibility is `hygieneStatus` (`READY` / `NEEDS_REVIEW` / `INVALID` / `SUPPRESSED`) — working tree.

---

## G. Compliance — **PARTIAL**

| Check | Status | Evidence |
| --- | --- | --- |
| Public unsub URL | **PARTIAL** | `GET /api/unsubscribe/[token]` (`app/api/unsubscribe/[token]/route.ts`) → JSON, not an HTML page. Token is `EmailRecipient.unsubscribeToken` (**Revenue-OS campaigns only**). Instantly `OutboundCampaign` body has **no** unsub merge tag or token |
| Physical address footer | **PARTIAL** | `EmailCampaign.physicalMailingAddress` + `evaluateCampaignCompliance` (`lib/revenue-os/campaigns.ts`). Instantly campaign create (`createOutreachCampaign`) has **no** address field |
| Campaign start blocked if compliance missing | **PARTIAL** | Revenue-OS `launchCampaign` uses compliance checklist. Instantly start only checks `MANAGED_SENDING_ENABLED` + ready contacts (working tree) |
| Suppression list | **PARTIAL** | Model `SuppressionListEntry`. No dashboard “suppression center” UI (`app/dashboard` has no suppression page) |

---

## H. Connect / subscriber-collected payments — **MISSING**

| Check | Status | Evidence |
| --- | --- | --- |
| Connect onboarding, application fee, flags | **MISSING** | `CONNECT_ENABLED` not in `.env.example`. Grep: only `app/platform/payouts/page.tsx` “without Stripe Connect splits” and a test asserting no Connect |
| Separate Connect Stripe account | **MISSING** | Single `STRIPE_SECRET_KEY` |

Affiliate commissions are **internal ledger + mark-paid**, not Connect transfers (`lib/affiliates/service.ts`).

---

## I. Domains wholesale — **PARTIAL**

| Check | Status | Evidence |
| --- | --- | --- |
| OpenSRS purchase gated | **DONE** (gated off) | `DOMAIN_PURCHASING_ENABLED` default false. `lib/managed-domains/opensrs.ts` Horizon vs production |
| Cloudflare DNS gated | **DONE** (gated off) | `DNS_AUTOMATION_ENABLED`; `CloudflareDnsProvider.enabled()` |
| Sending domains only | **PARTIAL** | Instantly UI: subscriber adds sending hostname (`app/dashboard/sending/outbound/page.tsx`) — no OpenSRS. Path B purchases `ManagedDomain` (registrar), which the product definition does **not** want mixed with Instantly Google send |

Google Workspace **reseller provisioning**: **MISSING** (no matches).

---

## J. Ops / prod readiness — **PARTIAL**

| Check | Status | Evidence |
| --- | --- | --- |
| `.env.example` complete | **PARTIAL** | Present, but **duplicated blocks**: SES region `us-east-2` (L89) vs `us-west-2` (L193); duplicated `EMAIL_SENDING_ENABLED`, `DOMAIN_PURCHASING_ENABLED`, `OPENSRS_*` |
| Preview vs Production | **PARTIAL** | `docs/ops-production-domain.md`, `docs/ops-sending-readiness.md`, `docs/stripe-commerce.md`. `docs/private-beta-launch.md` still mentions **Clerk** (auth is Better Auth) and “email sending not enabled / outreach draft” — **stale** |
| Broken empty states | **PARTIAL** | Live Instantly UI. Stubs: `/dashboard/campaigns`, `/dashboard/email-sequences`, former `/dashboard/imports` (fixed in working tree) |
| Tests | **PARTIAL** | Strong: pay-first, Stripe webhook, entitlements mapping, Instantly limits, Google OAuth, account-setup email, hygiene (local). Weak: no E2E “paid user cannot add inbox after PAST_DUE”; Instantly unsub/footer untested because missing |
| Operator visibility | **PARTIAL** | `/platform/subscribers`, `/platform/subscriptions`, `/platform/workspaces`, `/platform/email`, `/platform/deliverability`, `/platform/readiness`. Subscriber usage of Instantly inboxes is on `/dashboard/sending/outbound`, not a full health console |

Hourly cron: `vercel.json` → `/api/internal/jobs/run` (warmup/SES jobs). **Does not process Instantly campaign batches.**

---

## 3. P0 blockers — real paying user (checkout → account)

These block “I paid and I cannot get a workspace” or “we cannot take TEST money safely.”

1. **Configure Stripe TEST + `BILLING_ENABLED=true` + Price IDs** (ops, code ready). Without this, checkout is 503 (`lib/billing/config.ts`).
2. **Transactional mail reliability.** SES-only. If sandbox denies the purchaser, they still get the on-page link (`FAILED` / `DEFERRED_PREVIEW_LINK`). **P0 for “email-first” promise; not P0 for “can log in”** because fallback exists.
3. **Commit + migrate hygiene** before any customer CSV import on this branch, or Instantly lists enroll unhygiened contacts.
4. **Do not turn on SES campaign send** (`CAMPAIGN_SEND_BATCH` / `AwsSesTransport` / `LIVE_CAMPAIGN_SENDING_ENABLED`). Product forbids platform SES for subscriber campaigns.
5. **Fix `.env.example` SES region conflict** before production SES transactional send (`us-east-2` is the documented quantumreach.app region).

Not P0: Connect, OpenSRS live, unibox, sequences.

---

## 4. P1 — Instantly-like outbound, safely

Ordered; each is a slice.

1. **Ship hygiene** (commit working tree, migrate `20260826000000_contact_hygiene`, deploy). Audience = `READY` only.
2. **Instantly campaign compliance:** required physical mailing address; inject unsubscribe URL into every send; HTML unsub page (not JSON-only); write Instantly send unsubscribes into `SuppressionListEntry`.
3. **Campaign worker:** cron/job type that calls `processCampaignBatch` under `MANAGED_SENDING_ENABLED`, independent of SES `CAMPAIGN_SEND_BATCH`.
4. **Inbox/domain warm-up on Instantly `Inbox`:** day-1 cap &lt; 30, ramp to 30; `canSend` uses effective limit. Do not reuse SES `ManagedMailbox` warmup as the send path.
5. **PAST_DUE / CANCELED freeze Instantly send and new resources** (already blocked for new domains/inboxes via entitlements; add `canSend` + `startOutreachCampaign` checks).
6. **Stop-on-reply + unibox (Gmail API threads)** for connected Google inboxes; pause that contact’s jobs.
7. **Multi-step sequences** on `OutboundCampaign` (replace ModulePage stub `/dashboard/email-sequences`).
8. **Suppression center UI** (list, manual add, reason).
9. **Docs: kill SES Path A as customer cold send.** Point `docs/ops-sending-readiness.md` at Google Instantly path.

---

## 5. P2 — later

- Stripe Connect (`CONNECT_ENABLED`) on a **Connect-capable Stripe account**, application fee, webhooks — separate from original SaaS Stripe if both exist.
- OpenSRS **sending-domain** purchase only, Cloudflare apply gated, never core brand transfer.
- Google Workspace reseller mailbox provision (optional partner path). Product already allows OAuth-now.
- ~~SMTP / Private Email transactional transport~~ **done** (`EMAIL_TRANSPORT=smtp`). Remaining: auto-fallback when SES sandbox rejects and SMTP is also configured.
- PPC / public form / signed webhook ingest into hygiene.
- Clean dual-stack: hide or freeze SES `ManagedMailbox` campaign UI for subscribers.
- Replace remaining ModulePage stubs.
- Refresh `docs/private-beta-launch.md` (Clerk → Better Auth).

---

## 6. Ordered next build prompts (copy-paste)

### Prompt 1 — Transactional SMTP fallback (P0 for email-first)

```
On branch private-beta/commercial-lifecycle-hardening:

Add a transactional email transport adapter next to lib/email/transactional.ts.
Keep SES as default when AWS_SES_* is configured.
Add SMTP transport (nodemailer or fetch-based) selected by TRANSACTIONAL_TRANSPORT=ses|smtp.
SMTP env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE.
From/reply-to remain TRANSACTIONAL_FROM_EMAIL / TRANSACTIONAL_REPLY_TO.
If EMAIL_SENDING_ENABLED=true and SES send fails with sandbox/MessageRejected, optionally fall back to SMTP when configured (feature-flagged).
Account setup delivery statuses unchanged: SENT | DEFERRED_PREVIEW_LINK | FAILED.
Never use this transport from lib/outbound (campaigns).
Tests: unit mock SMTP vs SES; campaign providers still contain no SES client.
Do not add Connect, OpenSRS, or campaign features.
```

### Prompt 2 — Ship hygiene + Instantly compliance (P1)

```
On the current branch, commit/complete contact hygiene if not already merged.

Then add Instantly-path compliance only (lib/outbound, not Revenue-OS EmailCampaign):
- OutboundCampaign requires physicalMailingAddress (workspace default or per-campaign).
- Every send body/footer includes a unique unsubscribe URL.
- Public HTML GET /unsubscribe/[token] (keep API if needed).
- Click writes SuppressionListEntry and skips future Instantly jobs.
- Start campaign blocked if address or unsub missing, or 0 ready contacts.
- Worker: processCampaignBatch from /api/internal/jobs/run (new job type OUTBOUND_CAMPAIGN_BATCH), gated by MANAGED_SENDING_ENABLED.
Do not use AwsSesTransport or processQueuedEmailSend.
Tests: start blocked without address; unsub suppresses; worker processes a stub batch.
```

### Prompt 3 — Instantly warmup + subscription freeze (P1)

```
Wire warm-up to Instantly Inbox/SendingDomain only (not ManagedMailbox SES):
- New inbox starts below 30/day (e.g. day 1 = 5) and ramps to DEFAULT_INBOX_DAILY_LIMIT 30.
- Domain cap remains min(100, inboxes×30) using effective inbox limits.
- canSend/recordSend use effective dailyLimit.
- If SaasSubscription status is PAST_DUE, CANCELED, UNPAID: canSend false, startOutreachCampaign throws, addSendingDomain/addInbox already fail via entitlements — add explicit errors.
Do not implement unibox, Connect, or OpenSRS in this slice.
Tests: new inbox blocked at 5; PAST_DUE cannot start campaign.
```

---

## 7. Env var matrix

Secrets = never commit. Preview = Vercel Preview. Prod = `https://quantumreach.app`.

| Variable | Secret | Preview (checkout beta) | Production | Notes |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` / `DIRECT_DATABASE_URL` | yes | required | required | |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | yes / no | required | required | |
| `APP_BASE_URL` / `NEXT_PUBLIC_APP_URL` | no | Preview origin | `https://quantumreach.app` | Checkout + setup links |
| `BILLING_ENABLED` | no | `true` for TEST checkout | `true` only when live Prices + live webhook ready | Default `false` |
| `STRIPE_SECRET_KEY` | yes | **`sk_test_…` only** | `sk_live_…` | |
| `STRIPE_WEBHOOK_SECRET` | yes | TEST endpoint | live endpoint | `/api/webhooks/stripe` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | no | `pk_test_…` | `pk_live_…` | |
| `STRIPE_PRICE_*` (Core, Launch, Growth, Scale, setup) | no | TEST Price IDs | live Price IDs | Missing mapping fails checkout |
| `ADMIN_EMAILS` | no | required for `/platform` | required | |
| `EMAIL_SENDING_ENABLED` | no | `true` to try setup mail | `true` | Off → on-page setup link |
| `EMAIL_SANDBOX_MODE` | no | `true` until SES production access | `false` after SES prod access | |
| `AWS_SES_REGION` | no | `us-east-2` (quantumreach.app) | `us-east-2` | **Ignore duplicate `us-west-2` in `.env.example`** |
| `AWS_SES_ACCESS_KEY_ID` / `SECRET` | yes | if sending mail | if sending mail | |
| `TRANSACTIONAL_FROM_EMAIL` | no | `noreply@quantumreach.app` | same | |
| `TRANSACTIONAL_REPLY_TO` | no | `support@quantumreach.app` | same | |
| `MANAGED_SENDING_ENABLED` | no | `false` until Google Instantly ready | `true` for live Gmail send | Instantly campaigns |
| `GOOGLE_CLIENT_ID` / `SECRET` / `REDIRECT_URI` | yes | if testing Gmail send | required for cold send | |
| `DOMAIN_PURCHASING_ENABLED` | no | `false` | `false` until OpenSRS slice | |
| `DNS_AUTOMATION_ENABLED` | no | `false` | `false` until Cloudflare slice | |
| `INBOUND_EMAIL_SYNC_ENABLED` | no | `false` | `false` until unibox | |
| `MAILBOX_PROVISIONING_ENABLED` | no | `false` | `false` | Provider is DisabledMailboxProvider |
| `CRON_SECRET` / `JOB_RUNNER_SECRET` | yes | if cron | required | Instantly batch not hooked yet |
| `CONNECT_ENABLED` | — | **not in repo** | — | Do not invent |
| `EMAIL_TRANSPORT` | no | `smtp` if SES sandbox denies | `ses` or `smtp` | Default `ses`. Transactional only |
| `SMTP_HOST` / `PORT` / `USER` / `PASS` / `SECURE` | yes (pass) | if `EMAIL_TRANSPORT=smtp` | if using Private Email | Never for campaigns |

Simulated payments: Preview/dev only (`lib/simulated-payment/environment.ts`). Never production.

---

## 8. Do not build

- Scraping, LinkedIn automation, fake opens/replies/warm-up engagement (`docs/live-readiness-policy.md`, commercial warmup spec).
- **Platform SES or Private Email as subscriber cold-campaign transport.**
- Transferring or DNS-controlling the customer **core brand** domain (`lib/workspaces/core-domain.ts`).
- Using OpenSRS Horizon test contacts as production registrants.
- Stripe Connect, Google Workspace reseller, or wholesale domain purchase as a prerequisite for checkout beta.
- Enabling `CAMPAIGN_SEND_BATCH` / `AwsSesTransport` for Instantly lists.
- Public self-serve signup (`BETTER_AUTH_PUBLIC_SIGNUP_ENABLED`) for private beta — pay-first token only.

---

## Dual-stack map (avoid shipping the wrong one)

| Concern | Instantly / product definition | Legacy (keep dormant) |
| --- | --- | --- |
| Domain | `SendingDomain` | `ManagedDomain` + SES identity |
| Mailbox | `Inbox` + Google OAuth | `ManagedMailbox` + DisabledMailboxProvider |
| Send | `GoogleOutboundProvider` / stub | `AwsSesTransport` / `sendManagedEmail` |
| Campaign | `OutboundCampaign` | `EmailCampaign` / `EmailSend` |
| Limits | `canSend` 30 / min(100, n×30) | Warmup profiles, monthly ledger |
| UI | `/dashboard/sending/outbound` | `/dashboard/sending/senders`, mailboxes, domains (BYO SES) |
| Worker | **not hooked** | hourly jobs + warmup |

---

## Hygiene / uncommitted files (this working tree)

If still uncommitted when you ship:

- `lib/contacts/hygiene.ts`, `lib/contacts/ingest.ts`
- `prisma/migrations/20260826000000_contact_hygiene/`
- `app/dashboard/imports/**`
- Campaign ready-only changes in `lib/outbound/campaigns.ts`

Commit + `prisma migrate deploy` before customer CSV.

---

## Verify

- This file: `docs/ops/OPERATIONAL_GAP_AUDIT.md`
- Claims use repo paths or **MISSING** / **not found in repo**
- Next three prompts are in §6
