SOURCE: BUILD DIRECTOR

TASK TYPE:  
One-Pass Commercial Packaging, Managed Infrastructure, BYO-AI, and Deliverability Control Build

PROJECT:  
Quantum Reach

REPOSITORY:  
mblair2891/quantumreach

CURRENT WORK CONTEXT:

Quantum Reach is a multi-tenant SaaS platform with:

* `/platform` for Quantum Reach operators;  
* `/dashboard` for subscribers;  
* `/portal` for subscriber clients.

The system already contains or partially contains:

* public VSL and acquisition flow;  
* package selection;  
* subscriber signup;  
* canonical customer orders;  
* manual or complimentary financial clearance;  
* Stripe architecture;  
* workspace provisioning;  
* subscriptions and entitlements;  
* managed sending infrastructure;  
* domains;  
* mailboxes;  
* sender identities;  
* outreach campaigns;  
* email events;  
* AWS SES architecture;  
* DNS and domain-provider abstractions;  
* subscriber onboarding;  
* CRM;  
* meetings;  
* analysis;  
* proposals;  
* contracts;  
* client onboarding;  
* delivery;  
* reporting;  
* guided customer journeys.

Preserve all working behavior.

Do not rebuild completed subscriber acquisition, fulfillment, CRM, customer journey, platform administration, or Stripe architecture unnecessarily.

PRIMARY OBJECTIVE:

Implement the complete commercial, provider, AI-integration, and managed-sending architecture needed for Quantum Reach to sell three bundled SaaS packages.

Every package must include the complete Quantum Reach platform.

The packages differ primarily by:

* managed domains;  
* managed mailboxes;  
* outbound sending capacity;  
* team users;  
* active CRM contacts;  
* onboarding level;  
* support level;  
* operational capacity.

Quantum Reach must also:

1. Provision or manage subscriber domains through a reseller-friendly provider abstraction.  
2. Provision or manage hosted mailboxes.  
3. Use a separate bulk-email transport.  
4. Control mailbox and domain warm-up.  
5. Block all live campaign sending until measured deliverability conditions pass.  
6. Continuously monitor mailbox and domain health after activation.  
7. Support subscriber-provided AI API keys.  
8. Allow authorized client users to select from workspace-enabled AI providers and models.  
9. Track commercial cost, estimated COGS, margins, and infrastructure consumption.  
10. Present a clear package-selection and order-review experience.  
11. Never fabricate provider, payment, warm-up, delivery, or AI activity.

This is a one-pass implementation.

Do not leave core functionality as disconnected placeholders.

IMPLEMENTATION ASSUMPTIONS:

Treat the following as configurable launch defaults, not irreversible hardcoded business rules.

Recommended plans:

Launch:

* $297 per month  
* $750 one-time setup  
* 2 managed domains  
* 6 managed mailboxes  
* 5,000 active CRM contacts  
* 2 team users  
* approximately 4,500 mature outbound emails per month  
* standard onboarding  
* standard support

Growth:

* $597 per month  
* $1,500 one-time setup  
* 5 managed domains  
* 15 managed mailboxes  
* 25,000 active CRM contacts  
* 5 team users  
* approximately 11,500 mature outbound emails per month  
* priority onboarding  
* priority support  
* recommended plan

Scale:

* $997 per month  
* $2,500 one-time setup  
* 10 managed domains  
* 30 managed mailboxes  
* 100,000 active CRM contacts  
* 10 team users  
* approximately 23,000 mature outbound emails per month  
* expedited onboarding  
* priority or strategic support

All packages include:

* full CRM;  
* contacts;  
* companies;  
* leads;  
* opportunities;  
* pipeline;  
* tasks;  
* outreach;  
* managed sending;  
* meetings;  
* transcripts;  
* analysis;  
* proposals;  
* contracts;  
* client onboarding;  
* projects;  
* deliverables;  
* client portal;  
* reports;  
* guided next-best-action workflows.

Do not remove core product modules from lower tiers.

Package differences are capacity, service, support, and operational limits.

COMMERCIAL POSITIONING:

Quantum Reach is not merely a cold-email sender.

It is a complete client-growth operating system combining:

* CRM;  
* outreach;  
* managed sending;  
* meetings;  
* call and transcript analysis;  
* proposals;  
* agreements;  
* client onboarding;  
* delivery;  
* reporting;  
* AI-supported workflows.

Customer-facing package language should emphasize outcomes.

Suggested positioning:

Launch:  
Build your first repeatable client-acquisition system.

Growth:  
Run consistent outbound and manage a growing pipeline.

Scale:  
Operate multiple campaigns, team members, and a larger client-acquisition engine.

Do not market the plans only as domain and mailbox quantities.

PHASE 1 — REPOSITORY AUDIT

Before editing, inspect:

* Prisma schema;  
* all commerce-product models;  
* price and product metadata;  
* plan models;  
* subscription models;  
* entitlements;  
* customer orders;  
* line items;  
* infrastructure orders;  
* provisioning services;  
* sending domains;  
* mailboxes;  
* sender identities;  
* sending usage;  
* email send records;  
* email events;  
* suppressions;  
* bounce and complaint handling;  
* AWS SES integration;  
* AWS SNS integration;  
* OpenSRS integration or provider abstractions;  
* DNS provider abstractions;  
* Cloudflare integration;  
* warm-up models or existing statuses;  
* domain and mailbox health models;  
* scheduling and background-job architecture;  
* internal job runner;  
* operator catalog pages;  
* platform provider settings;  
* platform readiness pages;  
* subscriber sending pages;  
* subscriber billing pages;  
* subscriber onboarding;  
* public VSL;  
* `/start`;  
* infrastructure and setup selection;  
* order review;  
* `/platform/catalog`;  
* `/platform/plans`;  
* `/platform/sending-packages`;  
* `/platform/providers`;  
* `/platform/readiness`;  
* `/dashboard/sending`;  
* `/dashboard/sending/domains`;  
* `/dashboard/sending/mailboxes`;  
* `/dashboard/sending/overview`;  
* `/dashboard/sending/usage`;  
* `/dashboard/settings`;  
* `/portal`;  
* AI provider abstractions;  
* AI execution records;  
* current secret-storage approach;  
* current encryption utilities;  
* existing tests;  
* existing migrations;  
* environment-variable documentation.

Create a concise internal implementation map before making changes.

Do not create duplicate provider, pricing, subscription, CRM, or sending architectures.

PHASE 2 — COMMERCIAL PACKAGE MODEL

Implement or complete three configurable bundled subscriber plans:

* Launch  
* Growth  
* Scale

Each plan must support:

* display name;  
* slug;  
* description;  
* target customer;  
* monthly recurring price;  
* one-time setup price;  
* currency;  
* billing interval;  
* included domains;  
* included mailboxes;  
* included active CRM contacts;  
* included team users;  
* mature monthly sending allowance;  
* mature daily sending allowance;  
* recommended-plan flag;  
* onboarding level;  
* support level;  
* active/inactive state;  
* sort order;  
* entitlement mapping;  
* infrastructure-package mapping;  
* setup-product mapping;  
* price-display metadata;  
* internal cost assumptions;  
* effective date;  
* versioning or historical price preservation.

Do not depend solely on frontend constants.

Resolve package and price data server-side.

Existing orders and subscriptions must preserve the commercial terms accepted at purchase time.

Do not mutate historical orders when catalog pricing changes.

PHASE 3 — DEFAULT PLAN SEEDING

Add safe idempotent seeding or operator configuration for:

LAUNCH:

* monthly: 29700 cents  
* setup: 75000 cents  
* domains: 2  
* mailboxes: 6  
* CRM contacts: 5000  
* team users: 2  
* mature monthly sends: 4500  
* standard onboarding  
* standard support

GROWTH:

* monthly: 59700 cents  
* setup: 150000 cents  
* domains: 5  
* mailboxes: 15  
* CRM contacts: 25000  
* team users: 5  
* mature monthly sends: 11500  
* priority onboarding  
* priority support  
* recommended

SCALE:

* monthly: 99700 cents  
* setup: 250000 cents  
* domains: 10  
* mailboxes: 30  
* CRM contacts: 100000  
* team users: 10  
* mature monthly sends: 23000  
* expedited onboarding  
* strategic or highest available support

These are launch defaults.

Operators must be able to edit:

* price;  
* limits;  
* descriptions;  
* support labels;  
* onboarding labels;  
* active status;  
* effective date.

Do not require a code deployment to change package pricing.

PHASE 4 — PACKAGE ADD-ONS

Support configurable add-ons:

* additional managed domain;  
* additional managed mailbox;  
* additional domain plus three mailboxes;  
* additional 5,000 monthly sending allowance;  
* additional team user;  
* additional 25,000 CRM contacts;  
* additional 10 GB file storage;  
* domain replacement and reconfiguration;  
* expedited provisioning.

Suggested starting retail defaults:

Additional managed `.com` domain:

* $75 per year

Additional domain setup:

* $99 to $149 one time  
* choose a configurable default

Additional 10 GB mailbox:

* $15 per month

Additional domain plus 3 mailboxes:

* $49 to $69 per month  
* choose a configurable default

Additional 5,000 monthly outbound allowance:

* $25 to $50 per month  
* choose a configurable default

Additional team user:

* $25 per month

Additional 25,000 active CRM contacts:

* $50 per month

Additional 10 GB file storage:

* $10 per month

Expedited provisioning:

* $500 one time

All add-on prices must be editable in the operator catalog.

Do not hardcode them into order calculations.

PHASE 5 — CUSTOMER-FACING PACKAGE SELECTION

Complete `/start` as a polished package-selection page.

Display three plan cards:

Launch  
Growth  
Scale

Each card must show:

* package name;  
* monthly price;  
* one-time setup fee;  
* included full Quantum Reach platform;  
* domains;  
* mailboxes;  
* mature monthly sending capacity;  
* CRM contact capacity;  
* team-user capacity;  
* onboarding level;  
* support level;  
* warm-up notice;  
* provider-readiness notice;  
* clear primary action.

Mark Growth as recommended.

Suggested CTA labels:

* Choose Launch  
* Choose Growth  
* Choose Scale

Add customer-safe language:

“Sending capacity becomes available gradually as managed domains and mailboxes complete Quantum Reach’s health-based warm-up process.”

Do not promise full sending volume immediately.

Do not claim domains or mailboxes are active before provider provisioning.

PHASE 6 — ORDER REVIEW

Complete order review so it separates:

* Quantum Reach subscription;  
* one-time setup;  
* included managed domains;  
* included mailboxes;  
* included mature sending allowance;  
* add-ons;  
* expected initial amount;  
* expected recurring amount;  
* taxes if applicable;  
* unpaid or awaiting-clearance state;  
* infrastructure provisioning status;  
* warm-up requirement.

Customer-facing review must make clear:

* no payment has occurred until verified financial clearance;  
* no domain has been purchased until provider fulfillment succeeds;  
* no mailbox has been created until provider fulfillment succeeds;  
* sending is blocked until warm-up eligibility passes;  
* AI provider usage is billed directly to the subscriber’s AI provider when BYO AI is used.

PHASE 7 — INTERNAL COST MODEL

Implement an operator-only infrastructure cost and margin model.

Support configurable cost assumptions:

Domain registration:

* default planning assumption: $15.25 per `.com` per year

Hosted mailbox:

* default planning assumption: $1 per 10 GB mailbox per month

Bulk sending:

* default planning assumption: $0.10 per 1,000 emails

Vercel or application hosting:

* shared base cost;  
* per-plan estimated allocation

Database:

* shared base cost;  
* per-plan estimated allocation

Authentication:

* shared base cost;  
* per-active-user estimate

Object storage:

* per-GB storage;  
* request and processing reserve

Monitoring and background jobs:

* per-plan estimate

Support and operations reserve:

* per-plan amount or percentage

Payment processing:

* percentage plus fixed fee assumptions

Domain-replacement reserve:

* configurable per plan

Provider failure reserve:

* configurable per plan

Do not use these estimates for accounting claims.

Label them:

* planning estimate;  
* projected COGS;  
* projected margin.

PHASE 8 — DEFAULT COST ESTIMATES

Seed editable planning assumptions.

Launch estimated direct infrastructure:

* domains: approximately $2.54 per month equivalent  
* mailboxes: $6.00 per month  
* bulk sending: approximately $0.45 to $0.50 per month  
* application hosting and traffic: $3 to $8 per month  
* practical COGS planning range: $32 to $57 per month

Growth:

* domains: approximately $6.35 per month equivalent  
* mailboxes: $15.00 per month  
* bulk sending: approximately $1.15 to $2.00 per month  
* application hosting and traffic: $8 to $20 per month  
* practical COGS planning range: $81 to $143 per month

Scale:

* domains: approximately $12.71 per month equivalent  
* mailboxes: $30.00 per month  
* bulk sending: approximately $2.30 to $5.00 per month  
* application hosting and traffic: $20 to $50 per month  
* practical COGS planning range: $168 to $298 per month

The wider practical COGS ranges include:

* support;  
* operations;  
* monitoring;  
* backups;  
* payment processing;  
* provider retries;  
* domain replacement;  
* unexpected storage;  
* job processing;  
* operational variance.

Operators must be able to change every assumption.

PHASE 9 — OPERATOR PROFITABILITY DASHBOARD

Add or complete operator views for:

* package price;  
* estimated direct provider cost;  
* estimated shared-platform allocation;  
* estimated support reserve;  
* estimated practical COGS;  
* projected gross profit;  
* projected gross margin;  
* actual subscriber infrastructure consumption;  
* actual sending usage;  
* actual mailbox count;  
* actual domain count;  
* actual storage use;  
* provider-cost overrides;  
* add-on revenue;  
* plan-level margin.

Suggested location:

* `/platform/catalog`  
* `/platform/plans`  
* or a dedicated `/platform/economics`

Do not expose internal cost or margin information to subscribers or portal users.

PHASE 10 — DOMAIN PROVIDER ARCHITECTURE

Use a provider abstraction for domain registration and renewal.

Preferred initial provider:

OpenSRS

Potential backup provider:

NameSilo or another provider through the same abstraction.

Support:

* availability lookup;  
* registration;  
* renewal;  
* registrant contacts;  
* domain status;  
* expiration;  
* auto-renew;  
* transfer status;  
* nameserver configuration;  
* provider identifiers;  
* retry behavior;  
* webhook or polling status;  
* operator review;  
* customer-visible safe status.

Important ownership rule:

The subscriber or subscriber’s customer must be the legal registrant where appropriate.

Quantum Reach may manage:

* technical configuration;  
* reseller billing;  
* renewals;  
* DNS;  
* operational support.

Quantum Reach must not silently become the legal owner of customer domains.

Persist:

* registrant identity;  
* administrative contact;  
* technical contact;  
* billing contact;  
* consent;  
* verification state;  
* provider transaction ID;  
* renewal state.

Do not ask users to paste provider API secrets into chat or public forms.

PHASE 11 — MAILBOX PROVIDER ARCHITECTURE

Use a mailbox-provider abstraction.

Preferred launch mailbox provider:

OpenSRS Hosted Email

Support:

* mailbox creation;  
* mailbox suspension;  
* mailbox deletion;  
* password or credential initialization;  
* storage tier;  
* domain association;  
* inbound status;  
* IMAP availability;  
* SMTP availability where applicable;  
* provider status;  
* aliases;  
* forwarding;  
* catch-all policy;  
* credential rotation;  
* operator retries.

Do not use hosted-mailbox SMTP as the primary bulk-campaign transport unless the provider explicitly supports and authorizes that use.

PHASE 12 — BULK EMAIL TRANSPORT

Preferred bulk transport:

Amazon SES

Support:

* API-based sending;  
* verified identities;  
* DKIM;  
* custom MAIL FROM where configured;  
* SNS event ingestion;  
* bounce handling;  
* complaint handling;  
* suppression;  
* account sending quotas;  
* account reputation;  
* retryable provider errors;  
* provider throttling;  
* rate limiting;  
* webhook idempotency.

Keep the bulk transport separate from mailbox hosting.

Conceptual architecture:

OpenSRS:

* domain registration;  
* hosted mailbox;  
* inbound access;  
* reply mailbox.

Cloudflare or approved DNS provider:

* DNS records.

Amazon SES:

* outbound bulk transport;  
* bounce and complaint events.

Quantum Reach:

* sending identity;  
* capacity;  
* scheduling;  
* warm-up;  
* health evaluation;  
* suppression;  
* campaigns;  
* replies;  
* reporting.

PHASE 13 — DNS PROVIDER

Use the existing DNS abstraction where possible.

Preferred DNS automation:

Cloudflare

Support:

* SPF;  
* DKIM;  
* DMARC;  
* MX;  
* custom MAIL FROM;  
* tracking-domain records where supported;  
* verification polling;  
* DNS propagation status;  
* record reconciliation;  
* idempotent updates;  
* rollback or safe failure;  
* operator override.

Do not falsely mark authentication as complete until DNS validation succeeds.

PHASE 14 — DOMAIN AND MAILBOX LIFECYCLE

Implement or complete controlled lifecycle states.

Domain states:

* REQUESTED  
* REGISTRATION\_PENDING  
* REGISTERED  
* DNS\_PENDING  
* DNS\_CONFIGURING  
* AUTHENTICATION\_PENDING  
* AUTHENTICATED  
* WARMUP\_PENDING  
* WARMING  
* LIVE\_READY  
* THROTTLED  
* PAUSED  
* RECOVERY  
* FAILED  
* EXPIRED  
* RETIRED

Mailbox states:

* REQUESTED  
* PROVISIONING  
* PROVISIONED  
* DNS\_PENDING  
* AUTHENTICATED  
* WARMUP\_PENDING  
* WARMING  
* WARMUP\_HELD  
* LIVE\_READY  
* THROTTLED  
* PAUSED  
* RECOVERY  
* FAILED  
* RETIRED

Live campaign sending must be blocked for every state except:

* LIVE\_READY

THROTTLED may support reduced live sending only if explicitly allowed by policy.

Default behavior should be blocked unless the transport policy clearly permits reduced traffic.

PHASE 15 — PLATFORM-ENFORCED WARM-UP

Quantum Reach must control warm-up centrally.

The subscriber must not be able to bypass warm-up.

No public or subscriber-facing “Go live now” control may exist.

A mailbox may become live only when Quantum Reach evaluates sufficient health data and assigns:

LIVE\_READY

Warm-up must be based on:

* minimum elapsed duration;  
* minimum delivered sample;  
* consecutive healthy days;  
* authentication readiness;  
* mailbox test readiness;  
* domain readiness;  
* provider-account health;  
* bounce metrics;  
* complaint metrics;  
* delivery metrics;  
* throttle events;  
* suppression health;  
* consistency;  
* list-quality indicators.

Date alone must never promote a mailbox.

PHASE 16 — RECOMMENDED WARM-UP SCHEDULE

Create configurable warm-up policies.

Recommended default schedule:

Days 1–3:

* 5 messages per mailbox per day

Days 4–7:

* 10 messages per mailbox per day

Days 8–14:

* 15 messages per mailbox per day

Days 15–21:

* 20 to 25 messages per mailbox per day

Days 22–28:

* 25 to 30 messages per mailbox per day

Day 29 onward:

* 30 to 35 messages per mailbox per day

Mature default:

* 35 messages per mailbox per day

Maximum ordinary default:

* 50 messages per mailbox per day

Default mailboxes per domain:

* 3

Default mature domain cap:

* 105 messages per day

Maximum ordinary domain cap:

* 150 messages per day

The controller may:

* increase;  
* hold;  
* reduce;  
* pause;  
* resume;  
* promote live;  
* demote live.

It must not increase solely because time passed.

PHASE 17 — STATISTICAL LIVE-READINESS GATES

Recommended hard gates:

Authentication:

* SPF passing  
* DKIM passing  
* DMARC present and valid

Mailbox tests:

* outbound test successful  
* inbound test successful

Provider event system:

* bounce processing operational  
* complaint processing operational  
* suppression processing operational

Warm-up:

* minimum 21 to 30 days  
* at least 7 consecutive healthy days  
* at least 150 to 250 delivered messages

Health:

* hard-bounce rate below 2%  
* complaint rate below 0.1%  
* delivery rate at least 95%  
* no unresolved provider throttling  
* no unresolved authentication failure  
* no domain-level pause  
* mailbox health score at or above configured threshold

Recommended eligibility:

* health score at least 90;  
* all hard gates pass;  
* minimum duration passes;  
* minimum sample passes;  
* healthy-day requirement passes.

All thresholds must be operator-configurable.

PHASE 18 — HEALTH SCORE

Implement a deterministic explainable health score.

Suggested weights:

* authentication: 20  
* delivery success: 20  
* bounce health: 20  
* complaint health: 20  
* sending consistency: 10  
* provider health: 5  
* domain health: 5

Total:  
100

The score must include:

* component score;  
* measured value;  
* threshold;  
* pass/fail;  
* explanation;  
* timestamp;  
* sample window.

Do not use AI to decide live eligibility.

AI may summarize health information, but the decision must remain deterministic and auditable.

PHASE 19 — HARD OVERRIDES

These conditions must block or demote live eligibility regardless of total score:

* SPF failure;  
* DKIM failure;  
* DMARC missing or invalid;  
* complaint rate at or above emergency threshold;  
* hard-bounce rate above pause threshold;  
* provider account suspension;  
* missing bounce processing;  
* missing complaint processing;  
* missing suppression processing;  
* unresolved credential failure;  
* domain paused;  
* known blocklist or provider warning when integrated;  
* daily provider quota exhausted;  
* legal or abuse hold.

PHASE 20 — HEALTH THRESHOLDS

Recommended defaults:

Healthy hard-bounce rate:

* below 2%

Hold range:

* 2% to 3%

Automatic mailbox pause:

* above 3%

Healthy complaint rate:

* below 0.1%

Warning range:

* approaching 0.1%

Emergency pause:

* at or above 0.3%

Healthy delivery rate:

* at least 95%

Provider throttle:

* hold or reduce

Authentication failure:

* immediate pause

Domain reputation warning:

* domain pause or operator review

All thresholds must be configurable.

PHASE 21 — DAILY WARM-UP CONTROLLER

Implement a scheduled daily controller.

For each mailbox:

1. Load mailbox status.  
2. Load domain status.  
3. Load assigned warm-up policy.  
4. Load last evaluation.  
5. Load current metrics.  
6. Load provider health.  
7. Load authentication state.  
8. Load delivered sample.  
9. Load consecutive healthy days.  
10. Calculate deterministic score.  
11. Apply hard gates.  
12. Select one decision.  
13. Persist the decision.  
14. Persist human-readable reasons.  
15. Update limits or state.  
16. emit audit activity;  
17. notify subscriber when appropriate;  
18. notify operator on hold, pause, or failure.

Decision types:

* INCREASE  
* HOLD  
* REDUCE  
* PAUSE  
* RESUME  
* PROMOTE\_LIVE  
* DEMOTE\_LIVE  
* NO\_CHANGE  
* OPERATOR\_REVIEW\_REQUIRED

Make the job idempotent by mailbox and evaluation date.

PHASE 22 — NO LIVE SENDING BEFORE READINESS

Enforce sending eligibility inside the server-side send service.

Every live campaign message must pass:

* mailbox is LIVE\_READY;  
* domain is LIVE\_READY;  
* provider account healthy;  
* mailbox not suspended;  
* domain not suspended;  
* campaign approved;  
* recipient not suppressed;  
* mailbox daily capacity remains;  
* domain daily capacity remains;  
* provider quota remains;  
* sending window is allowed;  
* workspace entitlement is valid;  
* subscription is valid;  
* infrastructure package permits the traffic.

Do not rely only on frontend buttons.

API calls and background jobs must also be blocked.

Return a stable domain error such as:

MAILBOX\_NOT\_LIVE\_READY

Customer-safe message:

“This mailbox is still completing Quantum Reach’s managed warm-up process and cannot send live campaign traffic yet.”

PHASE 23 — CAPACITY LEDGER

Implement one shared outbound capacity ledger.

All outbound traffic must count toward the same daily mailbox and domain capacity:

* warm-up traffic;  
* campaign messages;  
* follow-ups;  
* manual outbound messages;  
* system-generated outbound messages where applicable.

Before LIVE\_READY:

* warm-up traffic only;  
* live campaign traffic equals zero.

After LIVE\_READY:

* live campaign;  
* follow-ups;  
* manual sends;  
* maintenance traffic;

must remain under mailbox and domain limits.

Do not allow separate subsystems to each consume the full daily allowance.

PHASE 24 — DOMAIN-LEVEL PROTECTION

Aggregate mailbox health at the domain level.

If a domain exceeds domain thresholds:

* mark domain PAUSED or THROTTLED;  
* stop all related mailbox live sending;  
* hold queued campaign sends;  
* notify subscriber;  
* create operator investigation;  
* persist reasons;  
* require a recovery decision.

One unhealthy mailbox may be paused alone unless domain-wide thresholds are exceeded.

PHASE 25 — CONTINUOUS MONITORING AFTER LIVE ACTIVATION

LIVE\_READY is not permanent.

Continuously evaluate:

* daily delivery rate;  
* hard-bounce rate;  
* soft-bounce rate;  
* complaint rate;  
* unsubscribe rate;  
* suppression events;  
* provider throttle events;  
* authentication state;  
* credential health;  
* domain health;  
* campaign quality;  
* send consistency.

A live mailbox may transition to:

* THROTTLED  
* PAUSED  
* RECOVERY  
* RETIRED

When health drops.

Queued sends must respond safely to status changes.

PHASE 26 — RECOVERY PROCESS

Implement recovery rules.

Suggested flow:

LIVE\_READY  
→ health failure  
→ PAUSED  
→ operator or automated evaluation  
→ RECOVERY  
→ reduced warm-up schedule  
→ consecutive healthy days  
→ LIVE\_READY

Recovery must:

* start below prior sending volume;  
* require new healthy evidence;  
* preserve historical metrics;  
* not erase previous pause reasons;  
* create audit events.

PHASE 27 — SUBSCRIBER WARM-UP DASHBOARD

Complete subscriber-facing warm-up views.

Show:

* domain;  
* mailbox;  
* current state;  
* warm-up day;  
* current daily limit;  
* messages sent today;  
* warm-up messages sent today;  
* live campaign messages sent today;  
* delivery rate;  
* bounce rate;  
* complaint rate;  
* health score;  
* consecutive healthy days;  
* delivered sample;  
* next eligibility review;  
* requirements still missing;  
* hold reason;  
* pause reason;  
* provider readiness;  
* DNS readiness.

Do not promise a guaranteed live date.

Use language such as:

* “Next eligibility review: tomorrow”  
* “Remaining requirement: 3 additional healthy days”  
* “Blocked: DKIM verification incomplete”  
* “Held: hard-bounce rate requires review”

PHASE 28 — SUBSCRIBER CONTROLS

Subscribers may:

* view warm-up status;  
* view health explanations;  
* pause warm-up;  
* request operator review;  
* replace a mailbox;  
* replace a domain where permitted;  
* configure sending windows after activation;  
* select recipient-local scheduling preferences;  
* review capacity use.

Subscribers may not:

* skip warm-up;  
* force live activation;  
* alter health statistics;  
* override authentication failure;  
* exceed limits;  
* resume a provider-suspended mailbox;  
* edit provider event data;  
* disable bounce or complaint processing.

PHASE 29 — OPERATOR WARM-UP CONTROLS

Operators may:

* inspect metrics;  
* inspect decisions;  
* hold;  
* pause;  
* resume;  
* retire;  
* replace;  
* assign a warm-up policy;  
* request re-verification;  
* force a health re-evaluation;  
* trigger safe recovery;  
* use emergency override.

Emergency override requirements:

* operator authorization;  
* explicit reason;  
* expiration;  
* audit event;  
* visible warning;  
* reversible action.

Do not allow permanent silent override.

PHASE 30 — WARM-UP DATA MODEL

Persist appropriate records.

Suggested entities or equivalent existing-model extensions:

WarmupPolicy:

* name  
* stages  
* limits  
* thresholds  
* minimum duration  
* minimum sample  
* healthy-day requirement  
* active state

MailboxWarmupProfile:

* mailbox  
* policy  
* start date  
* current stage  
* current limit  
* status  
* next evaluation  
* last decision

MailboxHealthSnapshot:

* time window  
* delivered  
* bounced  
* complained  
* throttled  
* delivery rate  
* bounce rate  
* complaint rate  
* score  
* component details

DomainHealthSnapshot:

* aggregate mailbox metrics  
* authentication state  
* provider warnings  
* score  
* status

ProviderHealthSnapshot:

* provider account  
* sending quota  
* bounce pipeline health  
* complaint pipeline health  
* suppression health  
* account status

WarmupDecision:

* mailbox  
* domain  
* evaluation date  
* action  
* prior state  
* next state  
* prior limit  
* next limit  
* score  
* hard gates  
* reasons  
* evaluator version

SendingCapacityLedger:

* mailbox  
* domain  
* workspace  
* date  
* traffic type  
* count  
* reserved count  
* committed count

PauseEvent:

* target  
* reason  
* actor  
* timestamp  
* resolution

LivePromotionEvent:

* evidence  
* score  
* thresholds  
* evaluator version  
* timestamp

OverrideEvent:

* operator  
* reason  
* expiration  
* previous state  
* new state

Use existing models where they already serve these purposes.

Avoid unnecessary model duplication.

PHASE 31 — WARM-UP TRAFFIC SAFETY

Do not implement deceptive artificial engagement.

Warm-up traffic must comply with provider rules and applicable law.

Do not fabricate:

* replies;  
* opens;  
* clicks;  
* conversations;  
* recipient engagement.

If using a third-party warm-up network:

* require provider configuration;  
* label it clearly;  
* isolate it from live campaign metrics;  
* record its source;  
* never treat artificial interactions as real prospect engagement;  
* do not use it if it violates provider policies.

Preferred safe approach:

* controlled ramping;  
* verified recipient strategy;  
* test inboxes;  
* permissioned messages;  
* list hygiene;  
* authentication;  
* suppression;  
* low-volume real sending;  
* health-based increases.

PHASE 32 — BYO AI ARCHITECTURE

Implement subscriber-provided AI credentials.

Workspace owners or authorized workspace administrators may connect:

* OpenAI;  
* Anthropic;  
* Google Gemini;  
* future providers through adapters.

Do not require Quantum Reach to pay subscriber AI token usage by default.

The provider bills the subscriber directly.

Quantum Reach remains the orchestration and workflow layer.

PHASE 33 — AI CREDENTIAL SECURITY

AI keys must:

* be submitted over authenticated HTTPS;  
* be encrypted server-side;  
* be stored in a dedicated credential model or approved encrypted secret store;  
* never be logged;  
* never be returned to the browser;  
* never be displayed after save;  
* support replacement;  
* support revocation;  
* support rotation;  
* support server-side validation;  
* record last-four or masked identifier only where appropriate;  
* record connection status;  
* record who added or changed the credential;  
* record last successful test;  
* record last failure without exposing the secret.

Do not store plaintext keys.

Use authenticated encryption with a server-controlled encryption key.

Required environment variable name may include:

AI\_CREDENTIAL\_ENCRYPTION\_KEY

Do not ask the user to paste its value into chat.

Add the actual value directly to the deployment environment or secret store.

PHASE 34 — AI PROVIDER SETTINGS

Add workspace settings such as:

`/dashboard/settings/ai`

Allow workspace administrators to:

* connect providers;  
* test connection;  
* remove provider;  
* rotate credential;  
* enable or disable provider;  
* enable allowed models;  
* select default provider;  
* select default model;  
* assign feature-level provider;  
* assign project-level provider;  
* set client-user permissions;  
* set monthly token or cost alerts;  
* set per-feature model restrictions;  
* review usage;  
* review failures.

Show:

“AI usage is billed directly by your selected provider.”

PHASE 35 — CLIENT PORTAL AI CHOICE

Client users may select only from provider/model choices enabled by the subscriber workspace administrator.

Client users must not:

* view the actual API key;  
* retrieve credentials;  
* add arbitrary providers unless explicitly granted an administrative role;  
* bypass model restrictions;  
* use a disabled provider;  
* access another workspace’s provider configuration.

Suggested client-facing workflow:

Workspace administrator:

* connects AI provider;  
* enables provider;  
* selects models;  
* grants project or client access.

Client user:

* sees approved provider/model labels;  
* selects from approved choices;  
* runs permitted AI workflow;  
* sees result and usage notice.

PHASE 36 — AI PROVIDER ADAPTERS

Create or complete a provider-neutral AI adapter.

Support:

* provider ID;  
* model ID;  
* structured prompt;  
* system prompt;  
* response schema;  
* timeout;  
* retries;  
* token usage;  
* estimated cost where provider returns it;  
* provider request ID;  
* failure type;  
* feature context;  
* project/client context;  
* audit metadata.

Implement adapters for configured providers only.

If a provider is not configured:

* show a clear setup requirement;  
* preserve manual workflow;  
* do not fail the entire feature;  
* do not fabricate AI output.

PHASE 37 — AI USAGE TRACKING

Persist:

* workspace;  
* user;  
* client or project where applicable;  
* provider;  
* model;  
* feature;  
* input-token estimate;  
* output-token estimate;  
* actual token counts where returned;  
* timestamp;  
* status;  
* provider request ID;  
* latency;  
* failure category;  
* direct-billing notice;  
* whether client user initiated the action.

Do not store full prompts or sensitive content unless current data-retention policy explicitly allows it.

Support configurable redaction or retention.

PHASE 38 — AI BUDGET AND PERMISSIONS

Allow workspace administrators to configure:

* enabled providers;  
* enabled models;  
* default model;  
* client-user access;  
* feature access;  
* monthly token alert;  
* monthly estimated-spend alert;  
* project-level provider;  
* maximum model tier;  
* disabled sensitive projects;  
* manual approval requirement.

Quantum Reach cannot enforce the subscriber’s provider-account bill directly unless the provider exposes appropriate quota APIs.

Present limits as:

* Quantum Reach usage controls;  
* alerts;  
* feature restrictions.

Do not claim guaranteed provider cost enforcement unless supported.

PHASE 39 — AI FAILURE BEHAVIOR

Handle:

* invalid credential;  
* revoked credential;  
* expired credential;  
* insufficient provider quota;  
* rate limit;  
* provider outage;  
* unsupported model;  
* model permission error;  
* content filter;  
* timeout;  
* malformed response.

Provide customer-safe errors and manual fallback.

Never display raw credential material.

PHASE 40 — ENTITLEMENTS

Ensure plan entitlements include:

* complete platform access;  
* domain quota;  
* mailbox quota;  
* CRM contact quota;  
* team-user quota;  
* mature monthly send quota;  
* AI integration availability;  
* AI provider count if restricted;  
* storage allowance;  
* support level;  
* onboarding level.

The complete CRM and delivery platform must remain included across Launch, Growth, and Scale.

Do not gate fundamental customer-lifecycle functionality by plan unless explicitly configured by operators.

PHASE 41 — USAGE ENFORCEMENT

Enforce server-side:

* number of domains;  
* number of mailboxes;  
* monthly mature sending allowance;  
* daily mailbox capacity;  
* daily domain capacity;  
* active CRM contacts;  
* team users;  
* storage;  
* add-ons.

Return clear errors:

PLAN\_DOMAIN\_LIMIT\_REACHED  
PLAN\_MAILBOX\_LIMIT\_REACHED  
PLAN\_SEND\_LIMIT\_REACHED  
PLAN\_CONTACT\_LIMIT\_REACHED  
PLAN\_TEAM\_LIMIT\_REACHED  
MAILBOX\_NOT\_LIVE\_READY  
DOMAIN\_NOT\_LIVE\_READY  
WARMUP\_CAPACITY\_EXHAUSTED  
PROVIDER\_UNHEALTHY  
AI\_PROVIDER\_NOT\_CONFIGURED  
AI\_MODEL\_NOT\_ALLOWED

Do not rely only on hidden UI controls.

PHASE 42 — BILLING AND COMMERCIAL INTEGRITY

Preserve:

* setup price;  
* recurring price;  
* add-on price;  
* accepted order terms;  
* catalog snapshot;  
* plan version;  
* financial-clearance method;  
* unpaid state;  
* Stripe state when enabled;  
* manual or complimentary state when authorized.

Do not mark infrastructure usage as paid revenue.

Keep separate:

* proposed value;  
* ordered value;  
* financially cleared value;  
* invoiced value;  
* paid value;  
* provider cost;  
* projected COGS;  
* actual COGS.

PHASE 43 — PROVIDER COST RECONCILIATION

Add operator support for actual provider costs.

Track where available:

* domain purchase cost;  
* renewal cost;  
* mailbox monthly cost;  
* SES message cost;  
* DNS cost;  
* storage cost;  
* AI cost only when Quantum Reach pays it;  
* retries;  
* credits;  
* refunds;  
* provider adjustments.

Keep planning assumptions separate from actual provider invoices.

PHASE 44 — CUSTOMER-FACING INFRASTRUCTURE STATUS

Subscribers should see:

* plan allowance;  
* active domains;  
* pending domains;  
* active mailboxes;  
* pending mailboxes;  
* warming mailboxes;  
* live-ready mailboxes;  
* paused mailboxes;  
* mature capacity;  
* currently available capacity;  
* monthly usage;  
* warm-up progress;  
* provider readiness;  
* next action.

Distinguish:

* purchased;  
* provisioned;  
* authenticated;  
* warming;  
* live-ready;  
* unavailable.

PHASE 45 — CUSTOMER-FACING PRICING LANGUAGE

Use accurate wording.

Examples:

“Complete Quantum Reach platform included.”

“Managed sending capacity becomes available after domain and mailbox verification and health-based warm-up.”

“Monthly sending capacity is an approximate mature allowance and depends on mailbox health, provider limits, recipient quality, and compliance.”

“AI provider usage is billed directly by your chosen AI provider when you connect your own API credentials.”

Do not promise:

* guaranteed deliverability;  
* guaranteed inbox placement;  
* guaranteed replies;  
* guaranteed revenue;  
* immediate full sending capacity;  
* automatic provider purchases before completion;  
* legally binding signatures unless supported.

PHASE 46 — VSL AND SALES COPY ALIGNMENT

Update the VSL and pricing copy so it reflects:

* complete client-growth operating system;  
* full CRM in every package;  
* managed domains and mailboxes;  
* controlled warm-up;  
* measurable live-readiness;  
* guided next best action;  
* BYO AI;  
* direct subscriber control over AI provider choice;  
* managed infrastructure;  
* transparent package capacities.

Primary CTA remains:

Join now

Route:

`/start`

Do not place a full pricing workflow on `/`.

PHASE 47 — OPERATOR PROVIDER READINESS

Complete `/platform/providers` or equivalent.

Show:

* OpenSRS configured;  
* domain API health;  
* mailbox API health;  
* Cloudflare configured;  
* DNS API health;  
* SES configured;  
* SES production access;  
* SNS bounce topic;  
* SNS complaint topic;  
* suppression pipeline;  
* warm-up scheduler;  
* AI credential encryption configured;  
* background-job health;  
* provider feature flags.

Never display actual secrets.

PHASE 48 — FEATURE FLAGS

Use explicit flags such as:

* DOMAIN\_PROVISIONING\_ENABLED  
* MAILBOX\_PROVISIONING\_ENABLED  
* DNS\_AUTOMATION\_ENABLED  
* SES\_SENDING\_ENABLED  
* WARMUP\_CONTROLLER\_ENABLED  
* LIVE\_CAMPAIGN\_SENDING\_ENABLED  
* BYO\_AI\_ENABLED  
* AI\_PROVIDER\_OPENAI\_ENABLED  
* AI\_PROVIDER\_ANTHROPIC\_ENABLED  
* AI\_PROVIDER\_GEMINI\_ENABLED

Use existing feature-flag architecture where available.

Default provider execution to off unless configuration and readiness checks pass.

PHASE 49 — SAFE PREVIEW MODE

Vercel Preview must support safe validation without real purchases or live sending.

In Preview:

* package selection works;  
* order creation works;  
* manual clearance works;  
* workspace provisioning works;  
* infrastructure orders persist;  
* provider actions may run in simulation or deferred mode;  
* domain records are not purchased;  
* mailboxes are not created;  
* SES live sending is blocked;  
* warm-up transitions can run against simulated health snapshots;  
* AI credentials may be tested only against subscriber-provided development keys;  
* no production secrets are used.

All simulations must be explicitly labeled and persisted.

PHASE 50 — SIMULATED WARM-UP TEST MODE

Provide an operator-only safe simulated warm-up mode for Preview and automated tests.

It must support:

* simulated DNS pass;  
* simulated mailbox send test;  
* simulated mailbox receive test;  
* simulated delivery counts;  
* simulated bounce counts;  
* simulated complaint counts;  
* simulated throttle event;  
* simulated healthy days;  
* simulated promotion;  
* simulated demotion;  
* simulated recovery.

No simulated metric may be mixed with live metrics.

Persist:

* isSimulated;  
* simulation source;  
* scenario identifier.

Suggested scenario:

QUANTUM\_REACH\_WARMUP\_VALIDATION

PHASE 51 — NOTIFICATIONS

Add or complete notifications for:

* domain registration started;  
* domain registration failed;  
* DNS verification required;  
* authentication passed;  
* mailbox provisioned;  
* warm-up started;  
* warm-up held;  
* warm-up reduced;  
* mailbox paused;  
* mailbox promoted live;  
* live mailbox demoted;  
* domain paused;  
* provider health issue;  
* plan capacity reached;  
* AI provider connected;  
* AI provider connection failed;  
* AI key rotated;  
* AI provider quota error.

If transactional email is unavailable, preserve notification intent without claiming delivery.

PHASE 52 — AUDIT LOGGING

Audit:

* package changes;  
* price changes;  
* cost-assumption changes;  
* provider configuration changes;  
* domain purchase attempts;  
* mailbox provisioning;  
* DNS modifications;  
* warm-up decisions;  
* health-score changes;  
* live promotions;  
* demotions;  
* operator overrides;  
* AI provider connections;  
* AI key rotation;  
* AI provider removal;  
* entitlement changes;  
* add-on assignments.

Never log credentials.

PHASE 53 — SECURITY

Preserve strict tenant isolation.

Every query and mutation must scope through:

* authenticated user;  
* workspace membership;  
* role;  
* workspace ID;  
* target-record workspace.

Do not trust workspace IDs from the browser.

Protect:

* domain data;  
* mailbox data;  
* provider references;  
* registrant data;  
* email events;  
* bounce data;  
* complaint data;  
* suppression data;  
* health snapshots;  
* warm-up decisions;  
* capacity ledgers;  
* AI credentials;  
* AI provider settings;  
* AI usage;  
* internal COGS data.

Platform operator cost data must never appear in subscriber or portal responses.

PHASE 54 — SECRET HANDLING

Never expose secrets.

Required environment variable names may include:

DATABASE\_URL  
DIRECT\_DATABASE\_URL

OPEN\_SRS\_USERNAME  
OPEN\_SRS\_API\_KEY  
OPEN\_SRS\_TEST\_MODE

CLOUDFLARE\_API\_TOKEN  
CLOUDFLARE\_ACCOUNT\_ID

AWS\_REGION  
AWS\_ACCESS\_KEY\_ID  
AWS\_SECRET\_ACCESS\_KEY  
AWS\_SES\_CONFIGURATION\_SET  
AWS\_SES\_BOUNCE\_TOPIC\_ARN  
AWS\_SES\_COMPLAINT\_TOPIC\_ARN  
AWS\_SNS\_WEBHOOK\_SECRET

AI\_CREDENTIAL\_ENCRYPTION\_KEY

WARMUP\_CONTROLLER\_ENABLED  
LIVE\_CAMPAIGN\_SENDING\_ENABLED  
DOMAIN\_PROVISIONING\_ENABLED  
MAILBOX\_PROVISIONING\_ENABLED  
DNS\_AUTOMATION\_ENABLED  
SES\_SENDING\_ENABLED  
BYO\_AI\_ENABLED

NEXT\_PUBLIC\_APP\_URL  
INTERNAL\_JOB\_SECRET

Use existing environment-variable names where already established.

Do not duplicate names unnecessarily.

Document placeholders only.

Tell operators:

“Add the actual value directly to your `.env` file or deployment-provider environment settings. Do not paste the secret value into chat.”

PHASE 55 — DATABASE AND MIGRATION SAFETY

Inspect all existing Prisma migrations.

Do not edit applied migrations.

Any schema change requires complete executable SQL.

Do not create comment-only migrations.

Preserve existing migration recovery history.

Run:

`npm run prisma:check-migrations`

Add indexes and constraints where needed for:

* warm-up evaluation idempotency;  
* daily capacity ledgers;  
* provider-event idempotency;  
* unique mailbox/provider identity;  
* unique domain/provider identity;  
* live-promotion events;  
* AI credential uniqueness;  
* AI usage lookup;  
* catalog-version lookup.

PHASE 56 — BACKGROUND JOBS

Use the current internal job framework.

Add or complete jobs for:

* provider provisioning;  
* DNS verification;  
* mailbox verification;  
* warm-up daily evaluation;  
* domain health aggregation;  
* provider health polling;  
* suppression reconciliation;  
* capacity resets;  
* live eligibility re-evaluation;  
* AI provider health check where appropriate.

Jobs must be:

* idempotent;  
* retry-safe;  
* observable;  
* tenant-safe;  
* protected by internal authorization;  
* bounded;  
* resumable;  
* auditable.

PHASE 57 — TEST REQUIREMENTS

Use the repository’s existing testing stack.

Add focused tests for commercial packaging:

* three plans seeded;  
* Growth recommended;  
* complete platform entitlements included;  
* prices resolved server-side;  
* historical order terms preserved;  
* inactive plan rejected;  
* add-ons validated;  
* capacity limits enforced;  
* internal COGS hidden from subscriber.

Provider tests:

* domain provider adapter;  
* mailbox provider adapter;  
* SES transport boundary;  
* DNS provider boundary;  
* provider-disabled behavior;  
* Preview simulation behavior;  
* no real provider call in simulation.

Warm-up tests:

* lifecycle states;  
* no live sending before LIVE\_READY;  
* date alone cannot promote;  
* minimum sample required;  
* healthy-day requirement;  
* authentication hard gates;  
* bounce hold;  
* bounce pause;  
* complaint emergency pause;  
* delivery-rate requirement;  
* provider-throttle hold;  
* domain pause cascades;  
* mailbox-only pause;  
* deterministic score;  
* score explanation;  
* one daily decision;  
* idempotent daily evaluation;  
* promotion;  
* demotion;  
* recovery;  
* operator override audit;  
* override expiration;  
* capacity ledger;  
* warm-up and campaign traffic share limits;  
* domain cap;  
* mailbox cap;  
* queued-send response to demotion;  
* simulated and live metrics remain separate.

BYO AI tests:

* encrypted credential storage;  
* plaintext never persisted;  
* secret never returned;  
* workspace isolation;  
* unauthorized client denied;  
* allowed client model selection;  
* disabled provider denied;  
* invalid key test;  
* key rotation;  
* provider removal;  
* usage record;  
* provider/model enforcement;  
* manual fallback;  
* no cross-workspace credential access.

Order and acquisition regression:

* package selection;  
* order review;  
* authentication resume;  
* canonical order creation;  
* subscriber provisioning;  
* onboarding;  
* dashboard access.

Customer-side regression:

* Summit Dental guided journey remains operational;  
* CRM tests pass;  
* outreach tests pass;  
* meeting tests pass;  
* proposal tests pass;  
* contract tests pass;  
* delivery tests pass.

PHASE 58 — SERVICE-LEVEL END-TO-END TESTS

Add a service-level commercial and infrastructure scenario:

1. Create Launch order.  
2. Verify package terms.  
3. Apply authorized test clearance.  
4. Provision workspace.  
5. Create two domain requests.  
6. Create six mailbox requests.  
7. Use simulated provider provisioning.  
8. Verify DNS.  
9. Begin warm-up.  
10. Run healthy daily evaluations.  
11. Confirm no live sends before eligibility.  
12. Reach minimum duration.  
13. Reach minimum sample.  
14. Reach healthy-day threshold.  
15. Promote mailbox and domain live.  
16. Send a live test campaign through a mocked transport.  
17. Record bounce and complaint events.  
18. Demote mailbox when thresholds fail.  
19. Enter recovery.  
20. Re-promote after healthy evidence.  
21. Connect a simulated encrypted AI provider credential.  
22. Allow approved client user to select an enabled model.  
23. Reject unapproved model.  
24. Record usage.  
25. Verify tenant isolation.  
26. Verify operator COGS visibility.  
27. Verify subscriber cannot see provider cost.  
28. Retry provisioning and warm-up jobs.  
29. Confirm no duplicate records.

PHASE 59 — MANUAL PREVIEW SMOKE TEST

Document:

1. Open Preview root.  
2. View VSL.  
3. Select Join now.  
4. Select Launch, Growth, or Scale.  
5. Review full package.  
6. Complete subscriber signup.  
7. Complete unpaid order.  
8. Apply operator manual clearance.  
9. Provision subscriber workspace.  
10. Open managed sending.  
11. Confirm included domain and mailbox limits.  
12. Create simulated domain request.  
13. Create simulated mailboxes.  
14. Confirm campaign sending is blocked.  
15. Simulate DNS success.  
16. Start warm-up.  
17. Run several simulated evaluations.  
18. Confirm score and reasons.  
19. Simulate healthy sample.  
20. Promote live.  
21. Confirm campaign sending becomes available.  
22. Simulate bounce-rate failure.  
23. Confirm automatic pause or demotion.  
24. Confirm queued sends stop.  
25. Enter recovery.  
26. Re-promote after healthy evidence.  
27. Open AI settings.  
28. Add a development AI key directly in Preview settings.  
29. Do not paste it into chat.  
30. Test the connection.  
31. Enable one provider/model for a client project.  
32. Sign in as authorized client.  
33. Confirm only approved provider/model appears.  
34. Run a test AI workflow.  
35. Confirm usage record.  
36. Confirm client cannot view key.  
37. Confirm another workspace cannot access any record.

PHASE 60 — DOCUMENTATION

Update:

* README.md  
* provider setup documentation  
* package and pricing documentation  
* warm-up architecture  
* live-readiness policy  
* deliverability policy  
* AI integration documentation  
* operator setup  
* Preview smoke test  
* environment variables  
* cost-model assumptions  
* add-on configuration  
* failure and recovery procedures.

Suggested files:

* `docs/commercial-packages.md`  
* `docs/provider-architecture.md`  
* `docs/managed-warmup.md`  
* `docs/live-readiness-policy.md`  
* `docs/byo-ai.md`  
* `docs/cost-model.md`  
* `docs/commercial-preview-smoke-test.md`

Do not include secrets.

PHASE 61 — VALIDATION COMMANDS

Determine the repository package manager and run applicable commands.

At minimum:

npx prisma format  
npx prisma validate  
npm run prisma:check-migrations  
npm run prisma:generate  
npm run typecheck  
npm run lint  
npm test  
npm run build  
git diff \--check

Run focused suites separately.

Use genuine non-production database values only when available.

Do not use fake database URLs to claim database-backed success.

If blocked by environment:

* state the exact limitation;  
* continue all possible validation;  
* provide exact local or Preview commands;  
* do not claim blocked checks passed.

PHASE 62 — SCOPE CONTROL

Do not:

* activate production Stripe without explicit approval;  
* purchase real domains in tests;  
* create real mailboxes in tests;  
* send live campaigns in Preview;  
* use production AWS credentials in Preview;  
* fabricate warm-up metrics as live;  
* fabricate replies;  
* fabricate engagement;  
* expose AI keys;  
* store plaintext AI keys;  
* allow client users to retrieve credentials;  
* allow subscribers to bypass warm-up;  
* weaken tenant isolation;  
* remove current customer workflows;  
* redesign unrelated platform pages;  
* hardcode irreversible prices;  
* commit secrets.

PHASE 63 — DEFINITION OF SUCCESS

This pass succeeds only when:

* Launch, Growth, and Scale are configurable commercial packages;  
* every plan includes the complete Quantum Reach platform;  
* plan differences are capacity and service;  
* package prices and limits are operator-editable;  
* order review clearly separates recurring and one-time charges;  
* provider abstractions support domains, mailboxes, DNS, and SES;  
* no live provider call occurs when disabled;  
* mailbox warm-up is platform-controlled;  
* live campaign sending is technically impossible before LIVE\_READY;  
* live-readiness depends on deterministic health gates;  
* domain-level health can block all related mailboxes;  
* live mailboxes can be automatically demoted;  
* recovery is implemented;  
* usage and capacity are enforced server-side;  
* subscribers can connect encrypted AI provider credentials;  
* client users can select only approved provider/model options;  
* AI provider costs are subscriber-paid by default;  
* internal COGS and margins are operator-only;  
* Preview simulation is explicit and safe;  
* automated tests pass;  
* production build passes;  
* no unrelated regressions occur.

FINAL RESPONSE REQUIRED FROM CODEX:

Return a structured report containing:

1. Executive summary  
2. Repository architecture inspected  
3. Existing modules reused  
4. Commercial package implementation  
5. Package prices and limits  
6. Add-on implementation  
7. Customer-facing pricing changes  
8. Order-review changes  
9. Internal cost model  
10. Operator profitability views  
11. Domain provider architecture  
12. Mailbox provider architecture  
13. SES transport architecture  
14. DNS automation  
15. Domain lifecycle  
16. Mailbox lifecycle  
17. Warm-up policy  
18. Health-score implementation  
19. Statistical live-readiness gates  
20. Daily controller  
21. Live-send enforcement  
22. Capacity ledger  
23. Domain-level protection  
24. Continuous monitoring  
25. Recovery process  
26. Subscriber warm-up UI  
27. Operator warm-up UI  
28. BYO-AI architecture  
29. Credential encryption  
30. AI provider adapters  
31. Client provider/model selection  
32. AI usage tracking  
33. Entitlement enforcement  
34. Provider readiness  
35. Feature flags  
36. Preview simulation  
37. Notifications  
38. Audit logging  
39. Tenant security  
40. Schema changes  
41. Migrations added  
42. Files created  
43. Files modified  
44. Tests added  
45. Focused test results  
46. Full test results  
47. Commands run  
48. Exact result of each command  
49. Build result  
50. Migration-integrity result  
51. Environment variables required  
52. Manual Preview smoke test  
53. Known limitations  
54. Deferred live-provider behavior  
55. Commit hash  
56. Recommended next action

Choose exactly one classification:

* Passed  
* Passed with limitations  
* Needs repair  
* Failed

Also classify separately:

* Commercial packaging built  
* Provider architecture built  
* Managed warm-up built  
* Live-readiness enforcement built  
* BYO AI built  
* Automated validation completed  
* Preview-ready  
* Deployment-ready  
* Launched  
* Production-tested

Do not classify the system as complete merely because models or screens exist.

The implementation must include enforcement, persistence, security, auditability, tests, and a passing build.

