# Private beta certification checklist

**Milestone:** Phase 6 — Preview end-to-end certification (commercial acquisition lifecycle)  
**Branch:** `main`  
**Scope:** Private-beta must-haves only. Live Stripe hard-gate, live SES send, domain purchase, mailbox provision, commissions/payouts are explicitly out of scope.

## Automated gates (Phase 0)

| Gate | Result |
|------|--------|
| `prisma migrate deploy` (no pending) | **PASS** (31 migrations, none pending) |
| `npm run test:db` × 2 consecutive | **PASS** (19/19; transient Neon deadlocks retried successfully) |
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| `npm test` (full unit suite) | **PASS** (397 tests) |
| `npm run build` | **PASS** |
| No staged `.env.backup` / `.env.local.backup` / `.env.production.run` | **PASS** (untracked only; not staged) |

## Must-have product checks

| # | Check | How validated |
|---|--------|----------------|
| 1 | `/start` → auth → order review → payment/simulation → provisioning | Unit + DB: `public-acquisition-flow`, `simulated-payment`, `customer-journey` service |
| 2 | Launch/Growth/Scale pricing and limits | `lib/commercial/packages.ts` + charge-lines tests + catalog bootstrap |
| 3 | Coupons independent of affiliate attribution | `commercial-coupons`, `coupons` DB tests; affiliate service has no coupon imports |
| 4 | Simulated payment Preview/local only; fail closed in production | `simulated-payment-environment` unit + service `assertSimulatedPaymentEnvironment` |
| 5 | Simulated payment runs canonical paid fulfillment once; replay no-op | `tests-db/simulated-payment.test.ts` |
| 6 | Paid activation auto-enrolls affiliate membership + code | fulfillment `paymentMethod !== "COMPLIMENTARY"` + `automatic-affiliate-enrollment` DB tests |
| 7 | Complimentary does **not** create affiliate membership | Source + fulfillment gate |
| 8 | Subscriber referral code view | `/dashboard/partner/referrals` ownership-scoped, read-only |
| 9 | Public referral route | `/r/[affiliateCode]` capture → `/start` |
| 10 | Access end retires code; resubscribe new period/code; old referrals stay | `affiliate-membership-periods` + automatic enrollment DB tests |
| 11 | Operator / subscriber / client boundaries | `saas-persona-boundaries`, navigation href prefixes |
| 12 | Live send / domain purchase / mailbox provision flags remain off for beta | Default `.env.example` + provider readiness docs |

## Preview manual smoke (human on Vercel Preview)

Run after deploy of the certified commit. Do **not** set production side-effect flags.

1. Open Preview `/start`, choose Growth (or Launch/Scale), complete priority + confirmation review.
2. Sign up / sign in, submit unpaid order.
3. Confirm **Preview payment testing** panel appears (not on production).
4. **Simulate successful payment** → setup status shows test payment; workspace accessible.
5. Open `/dashboard/partner` and `/dashboard/partner/referrals` → code + link visible.
6. Open `/r/{code}` in a private window → lands on `/start` with attribution cookie/session.
7. Operator: complimentary clearance on a **second** test order → access without affiliate membership.
8. Apply a coupon on review → totals update; no affiliate coupling.
9. Confirm live send / domain purchase still blocked or pending (flags off).
10. Spot-check contrast on confirmation, partner referral, and setup status (no white-on-white).

## Explicitly deferred (Phase 7+)

- Affiliate commissions, holds, clawbacks, payouts, tax forms, advanced analytics  
- Rich operator search/filtering  
- `BILLING_ENABLED=true` production hard gate + live Stripe checkout smoke  
- Live SES / OpenSRS purchase / mailbox provision / DNS automation execution  
- Shared multi-instance rate limiting, Trigger.dev registration  

## Certification sign-off

| Field | Value |
|-------|--------|
| Commit / deploy URL | _fill on Preview_ |
| Automated gates | _pass / fail_ |
| Manual Preview smoke | _pass / fail_ |
| Blockers | _none or list_ |
| Signed | _name / date_ |

**Definition of done:** Automated gates green on `main` and Preview manual smoke completed without must-have defects. “Built” alone is not certified.
