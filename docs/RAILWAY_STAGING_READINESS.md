# SBOS Railway Staging Readiness

Last verified locally: 2026-08-29
Worktree: `/Users/lonniebgroupllc/download/sbos-agent2-railway`
Branch: `docs/railway-staging-readiness`
HEAD: `fb4459fc19365dbf4a1b69ae21799dc1f082fb2a`

This runbook narrows the existing deployment and production-readiness docs into
the specific work needed to stand up a safe SBOS staging environment on
Railway. It is intentionally local-only and does not claim that any hosted
environment already exists.

## What the repo already supports

- Two container images exist: `apps/api/Dockerfile` and `apps/web/Dockerfile`.
- The API container runs `prisma migrate deploy` on startup.
- Production config validation already fails fast when required secrets are
  missing or left at development defaults.
- Existing docs already cover generic deployment flow in `docs/DEPLOYMENT.md`
  and cross-provider launch gates in `docs/PRODUCTION_READINESS_CHECKLIST.md`.

## Minimum staging shape on Railway

Provision four Railway services:

1. PostgreSQL
2. API container
3. Web container
4. Optional Redis placeholder only if queue work is being tested

Staging should mirror production shape closely enough to validate startup,
auth, migrations, and basic Jessie behavior, but it must stay isolated from
production data, domains, and secrets.

## Required staging configuration

### API service

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGINS`
- `NODE_ENV=production`

Optional, only if intentionally validating those adapters:

- `OPENAI_API_KEY`
- `AI_BASE_URL`
- `AI_MODEL`
- `STRIPE_SECRET_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

### Web service

- `AUTH_SECRET`
- `SBOS_API_URL`
- `NODE_ENV=production`

## Safe staging rules

- Use distinct staging secrets, never copied production values.
- Use a staging-only PostgreSQL instance.
- Do not run the demo seed against any production database.
- Keep staging domains and callback origins separate from production.
- Leave live-money and live-PHI paths disabled unless the needed approvals,
  BAAs, and test accounts already exist.

## Pre-deploy staging checklist

- Confirm both images build from the current commit in CI or locally.
- Confirm `.env.production.example` values have explicit staging replacements.
- Confirm `SBOS_API_URL` points to the Railway API service, not localhost.
- Confirm `CORS_ORIGINS` uses the exact staging web origin.
- Confirm `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `AUTH_SECRET` are all
  unique, non-default values.
- Confirm the target database is empty or intentionally prepared for staging.
- Confirm rollback owner and backup path before first migration apply.

## First-boot verification on Railway

After provisioning, verify these in hosted logs and HTTP checks:

1. API boot does not fail config validation.
2. `prisma migrate deploy` completes cleanly.
3. `GET /api/v1/health` returns healthy.
4. Web boot succeeds and `GET /api/health` returns healthy.
5. Login flow works against the staging API.
6. `GET /api/v1/platform/system-health` works for an authenticated admin.
7. Jessie routes still fall back safely when provider keys are absent.

## Known blockers before calling staging "ready"

- No Railway project, service IDs, staging URL, or hosted logs were verified in
  this worktree session.
- Managed PostgreSQL provisioning remains external to the repo.
- Redis-backed async jobs are still roadmap work, not a verified staging
  dependency for the current build.
- Provider-backed Jessie, email, SMS, and card flows remain credential-gated.
- HIPAA, encryption-at-rest, backups, and BAA controls remain separate launch
  gates even after a staging boot succeeds.

## Recommended next safe action

Use this runbook as the handoff checklist while creating a staging-only Railway
environment. Do not mark staging complete until the hosted boot, migrations,
health endpoints, and one authenticated smoke pass have all been verified with
fresh logs and HTTP evidence.
