# Operator bootstrap on Vercel Preview (no local machine)

Use this path when a Preview deployment needs a platform operator and you cannot (or should not) run `npm run seed:operator` from a laptop against the Preview database.

Local CLI seeding remains available: `npm run seed:operator`. **Browser bootstrap is the primary Preview path.**

## What this creates

Opening `/setup/operator` on a allowed environment creates:

1. Better Auth `user` (email + username)
2. Better Auth `account` credential (password hash)
3. App `UserProfile` linked via `authUserId`

Operator access is still decided by **`ADMIN_EMAILS`** (comma-separated). The bootstrap email must already be on that allowlist so `/platform` treats the account as an operator after sign-in.

## Safety rules

| Rule | Behavior |
|------|----------|
| Environment | Only when `VERCEL_ENV=preview` or local `NODE_ENV=development` |
| Production | Fail closed — `/setup/operator` returns **404** |
| Allowlist | Email must be listed in `ADMIN_EMAILS` |
| First operator | No secret required when no allowlisted auth user exists yet |
| Later operators | Requires env `BOOTSTRAP_SECRET` and the matching form field |
| Public signup | Unrelated to `BETTER_AUTH_PUBLIC_SIGNUP_ENABLED`; this is not self-service registration |

## Exact Preview steps (no local folder)

### 1. Configure Vercel environment variables (Preview)

In the Vercel project → **Settings → Environment Variables**, ensure at least:

| Variable | Example / notes |
|----------|------------------|
| `DATABASE_URL` | Preview/staging Postgres (already required) |
| `BETTER_AUTH_SECRET` | Strong random secret |
| `ADMIN_EMAILS` | Your operator email, e.g. `you@company.com` (comma-separated if multiple) |
| `BOOTSTRAP_SECRET` | Optional for first operator; **required** to create another after one exists |

Optional but recommended on Preview:

- `BETTER_AUTH_URL` or `NEXT_PUBLIC_APP_URL` — Preview URL if you set them; Better Auth also allows `*.vercel.app` hosts dynamically.
- Leave `BETTER_AUTH_PUBLIC_SIGNUP_ENABLED=false` (default).

Redeploy after changing env vars so the deployment picks them up.

### 2. Open the Preview deployment

1. Open the Vercel **Preview** URL for the branch (e.g. `https://quantumreach-….vercel.app`).
2. Go to:

```text
https://<your-preview-host>/setup/operator
```

You should see **“Create platform operator”** with a Preview-only notice. On production the same path is not available (404).

### 3. Create the first operator

Fill in:

| Field | Notes |
|-------|--------|
| **Email** | Must match an entry in `ADMIN_EMAILS` (case-insensitive) |
| **Username** | 3–32 chars: `a-z`, `0-9`, `_` (sign-in handle) |
| **Password** | At least 8 characters |
| **Confirm password** | Must match |

Submit **Create operator account**.

On success the app signs you in and redirects to **`/platform`**.

If sign-in cookies fail for any reason, open `/sign-in` with the same email/username and password; allowlisted operators still land on `/platform`.

### 4. If an operator already exists

1. Set `BOOTSTRAP_SECRET` in Vercel (Preview) to a strong random value and redeploy.
2. Open `/setup/operator` again.
3. Complete the form including **Bootstrap secret** (same value as the env var).

Without `BOOTSTRAP_SECRET`, the page explains that an operator already exists and does not offer public creation.

### 5. Smoke-check operator access

1. Visit `/platform` — operators see the platform console.
2. Visit `/sign-in` in a private window and sign in with email or username + password.
3. Confirm a non-allowlisted user cannot access `/platform` (redirected away).

## Common failures

| Symptom | Fix |
|---------|-----|
| 404 on `/setup/operator` | You are on production, or the gate is not Preview/local |
| “ADMIN_EMAILS is not configured” | Set `ADMIN_EMAILS` on the Preview env and redeploy |
| “not on the operator allowlist” | Add that exact email to `ADMIN_EMAILS` and redeploy |
| “An operator account already exists” | Set `BOOTSTRAP_SECRET` or sign in with the existing operator |
| “Invalid bootstrap secret” | Secret field must match env `BOOTSTRAP_SECRET` exactly |
| “An account with this email already exists” | Use `/sign-in` instead of bootstrap |
| Session not set after create | Use `/sign-in` with the password you just chose |

## Local development (optional)

Same UI:

```bash
# ADMIN_EMAILS must include the email you will use
npm run dev
# open http://localhost:3000/setup/operator
```

CLI alternative (still supported):

```bash
OPERATOR_EMAIL=you@company.com \
OPERATOR_PASSWORD='choose-a-strong-password' \
ADMIN_EMAILS=you@company.com \
  npm run seed:operator
```

## Related

- `scripts/seed-operator.ts` — CLI seed (`npm run seed:operator`)
- `lib/auth/operator-bootstrap.ts` — browser bootstrap service
- `lib/admin/operator.ts` — `ADMIN_EMAILS` / `requireOperatorAccess`
- `docs/platform-admin-console.md` — platform console overview
