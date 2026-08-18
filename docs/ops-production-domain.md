# Production site: quantumreach.app

Code cannot attach the Vercel domain or edit registrar DNS. Do these steps in Vercel and the registrar after this branch is merged to the production branch.

## 1. Vercel Production domain

1. Project → Settings → Domains.
2. Add `quantumreach.app` and `www.quantumreach.app`.
3. Redirect **www → apex** (`https://quantumreach.app`) so Stripe and customers have one canonical URL.
4. Production branch should be `main` (or the designated production branch). Preview stays on `*.vercel.app`.

## 2. DNS (do not break SES)

quantumreach.app is already used for **transactional SES** (`noreply@quantumreach.app`) in `us-east-2`. When adding web records:

- Add only the A / ALIAS / CNAME Vercel shows for the website.
- **Keep** existing SES DKIM CNAMEs, SPF TXT, DMARC, and MX if present.
- Do not replace the zone nameservers unless the domain is already on Vercel DNS and those email records are migrated first.

Confirm after change:

- `https://quantumreach.app` loads over HTTPS (valid cert).
- `https://www.quantumreach.app` redirects once to the apex (no loop).
- `/sign-in`, `/pricing`, `/contact`, `/privacy`, `/terms` resolve.
- Transactional mail still sends from `noreply@quantumreach.app`.

## 3. Production environment variables

Set on **Production** (not only Preview). Mirror Preview where the same integration is used.

Required for a reachable live site:

- `APP_BASE_URL=https://quantumreach.app`
- `NEXT_PUBLIC_APP_URL=https://quantumreach.app`
- `BETTER_AUTH_URL=https://quantumreach.app`
- `BETTER_AUTH_SECRET`
- `DATABASE_URL` / `DIRECT_DATABASE_URL`
- `ADMIN_EMAILS`
- SES transactional keys (`AWS_SES_REGION=us-east-2`, access key, `TRANSACTIONAL_FROM_EMAIL=noreply@quantumreach.app`)

Stripe: use **test** keys until business verification is complete; switch to live keys only in the Production env. Never commit live secrets.

Cron: set `CRON_SECRET` or `JOB_RUNNER_SECRET` so `vercel.json` can call `/api/internal/jobs/run` hourly.

Managed purchase (optional until OpenSRS is ready):

- `DOMAIN_PURCHASING_ENABLED=true`
- `DOMAIN_PROVIDER=opensrs`
- `OPENSRS_ENVIRONMENT=horizon` (test) or `production`
- `OPENSRS_USERNAME`, `OPENSRS_API_KEY`, `OPENSRS_API_BASE_URL`
- Horizon: `OPENSRS_REG_*` and `OPENSRS_TEST_CONTACT_*`
- Production: registrant snapshot from the workspace profile; `DOMAIN_SERVICE_CONTACT_*` for tech/admin

## 4. Stripe Dashboard (human)

Once `https://quantumreach.app` loads:

1. Business website = `https://quantumreach.app`
2. Complete Stripe business verification.
3. Keep webhook endpoint on the Production URL when live keys are enabled.

## 5. What this repo already provides

- Home, pricing, contact, privacy, and terms.
- Footer links on marketing pages.
- Canonical URL helpers already prefer `APP_BASE_URL`.
