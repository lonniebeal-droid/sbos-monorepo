# SBOS Railway Staging Readiness

Last verified locally: 2026-08-29
Worktree: `/Users/lonniebgroupllc/download/sbos-agent2-railway`
Branch: `docs/railway-staging-readiness`
HEAD: `6d3c557cb3965545851da09d50b465c8720e543c`

This runbook narrows the existing deployment and production-readiness docs into the specific work needed to stand up a safe SBOS staging environment on Railway. It is intentionally local-only and does not claim that any hosted environment already exists.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Railway Project                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   PostgreSQL │  │     API      │  │       Web        │  │
│  │  (managed)   │◄─│  (container) │◄─│   (container)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│         ▲                ▲                    ▲             │
│         │                │                    │             │
│         └────────────────┴────────────────────┘             │
│                    (internal networking)                     │
└─────────────────────────────────────────────────────────────┘
```

### Service Topology

| Service | Type | Port | Health Path | Build |
|---------|------|------|-------------|-------|
| PostgreSQL | Managed plugin | 5432 | `pg_isready` | N/A |
| API | Docker (NestJS) | 4000 | `/api/v1/health` | `apps/api/Dockerfile` |
| Web | Docker (Next.js) | 3000 | `/api/health` | `apps/web/Dockerfile` |

## What the Repo Already Supports

- Two container images exist: `apps/api/Dockerfile` and `apps/web/Dockerfile`
- The API container runs `prisma migrate deploy` on startup
- Production config validation already fails fast when required secrets are missing or left at development defaults
- Existing docs already cover generic deployment flow in `docs/DEPLOYMENT.md` and cross-provider launch gates in `docs/PRODUCTION_READINESS_CHECKLIST.md`
- Health endpoints implemented for both services
- Next.js configured for standalone output (`output: "standalone"`)
- API binds to `0.0.0.0` for Railway compatibility

## Railway Configuration

### railway.json

Project-level Railway configuration defining both services:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "services": {
    "api": {
      "build": {
        "builder": "DOCKERFILE",
        "dockerfilePath": "apps/api/Dockerfile"
      },
      "deploy": {
        "healthcheckPath": "/api/v1/health",
        "healthcheckTimeout": 300,
        "restartPolicyType": "ON_FAILURE",
        "restartPolicyMaxRetries": 10
      }
    },
    "web": {
      "build": {
        "builder": "DOCKERFILE",
        "dockerfilePath": "apps/web/Dockerfile"
      },
      "deploy": {
        "healthcheckPath": "/api/health",
        "healthcheckTimeout": 300,
        "restartPolicyType": "ON_FAILURE",
        "restartPolicyMaxRetries": 10
      }
    }
  }
}
```

## Build & Start Commands

### Local Build (for verification)
```bash
# Install dependencies
pnpm install --frozen-lockfile

# Build all packages
pnpm run build

# Run lint
pnpm run lint

# Run tests (note: 2 RBAC tests fail - upstream dependency)
pnpm run test
```

### Railway Build
Railway builds each service using its respective Dockerfile. No additional build commands needed.

### Start Commands (defined in Dockerfiles)

**API**: `sh -c "packages/database/node_modules/.bin/prisma migrate deploy --schema=packages/database/prisma/schema.prisma && node apps/api/dist/main.js"`

**Web**: `node apps/web/server.js`

## Health Endpoints

### API Health (`GET /api/v1/health`)
Returns liveness + readiness with database connectivity check:
```json
{
  "status": "ok|degraded",
  "service": "sbos-api",
  "database": { "status": "up|down", "latencyMs": 12.3 },
  "timestamp": "2026-08-29T20:00:00.000Z",
  "uptime": 1234
}
```
- `ok` = database reachable
- `degraded` = database unreachable (liveness still passes)

### Web Health (`GET /api/health`)
Simple liveness probe:
```json
{
  "status": "ok",
  "service": "sbos-web"
}
```

### Platform System Health (`GET /api/v1/platform/system-health`)
Authenticated admin endpoint with deeper checks (DB, Redis, external providers).

## Environment Variable Inventory

### Classification Legend
- **REQUIRED** = Must be set for service to start
- **OPTIONAL** = Only needed if testing specific integrations
- **SECRET** = Sensitive value, store in Railway secret manager
- **GENERATED_BY_RAILWAY** = Auto-provided by Railway platform
- **EXTERNAL_SERVICE** = Provided by external managed service

### API Service Variables

| Variable | Classification | Description |
|----------|---------------|-------------|
| `DATABASE_URL` | REQUIRED, EXTERNAL_SERVICE | PostgreSQL connection string (from Railway PG plugin) |
| `JWT_ACCESS_SECRET` | REQUIRED, SECRET | Access token signing secret (64+ chars) |
| `JWT_REFRESH_SECRET` | REQUIRED, SECRET | Refresh token signing secret (MUST differ from access) |
| `CORS_ORIGINS` | REQUIRED | Comma-separated staging web origins |
| `PORT` | GENERATED_BY_RAILWAY | Assigned by Railway (default 4000) |
| `NODE_ENV` | REQUIRED | Set to `production` |
| `OPENAI_API_KEY` | OPTIONAL, SECRET, EXTERNAL_SERVICE | For Jessie AI features |
| `AI_BASE_URL` | OPTIONAL | OpenAI-compatible endpoint |
| `AI_MODEL` | OPTIONAL | Model name (default: gpt-4o-mini) |
| `STRIPE_SECRET_KEY` | OPTIONAL, SECRET, EXTERNAL_SERVICE | Stripe payments |
| `RESEND_API_KEY` | OPTIONAL, SECRET, EXTERNAL_SERVICE | Email delivery |
| `EMAIL_FROM` | OPTIONAL | Sender address |
| `TWILIO_ACCOUNT_SID` | OPTIONAL, SECRET, EXTERNAL_SERVICE | SMS |
| `TWILIO_AUTH_TOKEN` | OPTIONAL, SECRET, EXTERNAL_SERVICE | SMS |
| `TWILIO_FROM_NUMBER` | OPTIONAL | SMS sender number |

### Web Service Variables

| Variable | Classification | Description |
|----------|---------------|-------------|
| `AUTH_SECRET` | REQUIRED, SECRET | Session cookie signing (64+ chars) |
| `SBOS_API_URL` | REQUIRED | Internal API URL (e.g., `http://api.railway.internal:4000`) |
| `NEXT_PUBLIC_API_URL` | REQUIRED | Public API URL for browser |
| `PORT` | GENERATED_BY_RAILWAY | Assigned by Railway (default 3000) |
| `NODE_ENV` | REQUIRED | Set to `production` |
| `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS` | OPTIONAL | Set `true` only for controlled demos |

### Generated by Railway (Do Not Set Manually)
- `RAILWAY_PROJECT_ID`
- `RAILWAY_SERVICE_ID`
- `RAILWAY_ENVIRONMENT_ID`
- `RAILWAY_DEPLOYMENT_ID`
- `PORT` (per service)

## PostgreSQL / Database

### Staging Database Requirements
- Railway PostgreSQL plugin (managed)
- Separate instance from production
- No production data
- SSL enabled (Railway default)

### Migration Strategy

**Automatic on API startup** (current implementation):
```dockerfile
CMD ["sh", "-c", "prisma migrate deploy && node apps/api/dist/main.js"]
```

**Rationale**: Simple, zero-downtime for additive migrations. Runs in container before API accepts traffic.

**Rollback Limitations**:
- `prisma migrate deploy` only applies pending migrations
- No built-in rollback command
- Rollback requires: manual SQL revert + `prisma migrate resolve --rolled-back`

**Safer Alternative for Staging** (recommended):
1. Run migrations as a separate Railway job before deploying API
2. Verify migration success in logs
3. Then deploy API without auto-migrate

To disable auto-migrate, change API Dockerfile CMD to:
```dockerfile
CMD ["node", "apps/api/dist/main.js"]
```
And run migrations manually:
```bash
railway run --service api -- pnpm --filter @sbos/database run prisma:deploy
```

### Migration Ordering
Migrations are versioned by timestamp in `packages/database/prisma/migrations/`:
1. `20260724000000_init` - Base schema
2. `20260725000000_clinical_versions_templates` - Note versions/templates
3. `20260725100000_scheduling` - Appointments/availability
4. `20260725200000_billing` - Claims/invoices/payments
5. `20260725300000_jessie_ai` - Conversations/knowledge
6. `20260725400000_feature_flags` - Feature flags
7. `20260726000000_composite_indexes` - Performance indexes
8. `20260726100000_refresh_tokens` - Token rotation
9. `20260818200000_waitlist_entry_org_fk` - Waitlist FK
10. `20260818210000_clinician_scheduling_org_fk` - Clinician FK
11. `20260818220000_client_soft_delete` - Soft delete
12. `20260818223000_document_soft_delete` - Document soft delete
13. `20260818230000_audit_action_deny` - Audit DENY action

### Seed Data
**Do not run production seed in staging.** The seed (`packages/database/prisma/seed.ts`) creates demo data. For staging:
- Run seed manually only if needed for smoke tests
- Use `pnpm --filter @sbos/database run db:seed`
- Consider a minimal staging-only seed script

## CORS / Proxy Configuration

### API CORS
Configured in `apps/api/src/main.ts`:
```typescript
app.enableCors({
  origin: configService.get('corsOrigins'),
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
});
```

**Staging Requirement**: `CORS_ORIGINS` must be the exact staging web URL (e.g., `https://staging-web.up.railway.app`)

### Web → API Proxy
Next.js middleware (`apps/web/src/middleware.ts`) proxies `/api/*` to `SBOS_API_URL`. Ensure:
- `SBOS_API_URL` uses internal Railway networking (e.g., `http://api.railway.internal:4000`)
- `NEXT_PUBLIC_API_URL` uses public URL for browser requests

### Trust Proxy
Next.js standalone server trusts `X-Forwarded-*` headers by default. No additional config needed.

## Graceful Shutdown

### API (NestJS)
NestJS handles `SIGTERM` gracefully by default. The `app.listen()` returns a server that closes connections on signal.

### Web (Next.js)
Next.js standalone server handles `SIGTERM` gracefully.

### Docker Healthchecks
Both Dockerfiles include HEALTHCHECK for container-level liveness.

## Logging for Staging

- **API**: Structured JSON logs via NestJS `LoggingInterceptor` (stdout)
- **Web**: Next.js structured logs (stdout)
- **Railway**: Aggregates stdout/stderr to log view
- **No file logging needed** - Railway captures container output

## Staging Deployment Steps

### Prerequisites
- [ ] Railway account with staging project created
- [ ] PostgreSQL plugin provisioned in staging project
- [ ] Redis plugin provisioned (optional, for future queue work)
- [ ] Staging secrets generated and stored in Railway UI

### Deployment Order
1. **Provision PostgreSQL** → Note `DATABASE_URL`
2. **Deploy API service** → Set all REQUIRED API variables
3. **Run migrations** (if disabled auto-migrate) → `railway run --service api pnpm --filter @sbos/database run prisma:deploy`
4. **Deploy Web service** → Set all REQUIRED Web variables
5. **Verify health endpoints** (see First-Boot Verification)

### First-Boot Verification on Railway

After provisioning, verify these in hosted logs and HTTP checks:

1. API boot does not fail config validation
2. `prisma migrate deploy` completes cleanly (or manual migration succeeds)
3. `GET /api/v1/health` returns `{"status":"ok",...}`
4. Web boot succeeds and `GET /api/health` returns `{"status":"ok"}`
5. Login flow works against the staging API
6. `GET /api/v1/platform/system-health` works for authenticated admin
7. Jessie routes fall back safely when provider keys are absent

## Rollback Plan

### API Rollback
1. Railway: `railway rollback --service api` (reverts to previous deployment)
2. If migration was applied: Manual SQL revert + `prisma migrate resolve --rolled-back <migration_name>`
3. Redeploy previous API image

### Web Rollback
1. Railway: `railway rollback --service web`

### Database Rollback
- **No automated rollback** - requires manual intervention
- Pre-deploy: Backup staging DB (Railway PG plugin provides point-in-time recovery)
- Document migration name before deploying

## Smoke Test Commands

```bash
# API health
curl -f https://staging-api.up.railway.app/api/v1/health

# Web health
curl -f https://staging-web.up.railway.app/api/health

# Authenticated platform health (requires valid JWT)
curl -H "Authorization: Bearer <token>" \
  https://staging-api.up.railway.app/api/v1/platform/system-health

# Login flow
curl -X POST https://staging-api.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@staging.example","password":"testpass"}'
```

## Known Blockers Before Calling Staging "Ready"

- [ ] No Railway project, service IDs, staging URL, or hosted logs verified in this worktree
- [ ] Managed PostgreSQL provisioning remains external to the repo
- [ ] Redis-backed async jobs are roadmap work, not a verified staging dependency
- [ ] Provider-backed Jessie, email, SMS, and card flows remain credential-gated
- [ ] HIPAA, encryption-at-rest, backups, and BAA controls remain separate launch gates
- [ ] **UPSTREAM_GATE5_DEPENDENCY = YES**: 2 RBAC tests fail (CLINICIAN role hierarchy) - blocked on Agent 1 Gate 5 merge
- [ ] **NEEDS_AGENT3_INTEGRATION = YES**: Jessie backend endpoints not yet implemented in this branch

## Upstream Dependencies

| Dependency | Owner | Status |
|------------|-------|--------|
| Gate 5 RBAC/security fixes | Agent 1 | NEEDS_GATE5_MERGE_OR_CHERRY_PICK = YES |
| Jessie backend endpoints | Agent 3 | NEEDS_AGENT3_INTEGRATION = YES |
| Commercial launch config | Agent 4 | Not blocking staging |

**Agent 1 Status (from commit 5505e9f)**: `lint=PASS`, `tests=PASS`, `build=PASS`, `GATE5_VERIFIED=YES locally`, `SAFE_TO_PROCEED_TO_STAGING=NO` (due to high dependency findings and rate-limit decision)

## Security Files Modified by Agent 2

**NO** - Agent 2 only modified:
- `apps/api/src/main.ts` - Added `0.0.0.0` binding for Railway
- `railway.json` - New Railway configuration
- `.env.staging.example` - New staging environment template
- `docs/RAILWAY_STAGING_READINESS.md` - This documentation

## Recommended Next Safe Action

Use this runbook as the handoff checklist while creating a staging-only Railway environment. Do not mark staging complete until the hosted boot, migrations, health endpoints, and one authenticated smoke pass have all been verified with fresh logs and HTTP evidence.

**Do not deploy to staging until:**
1. Agent 1 changes are merged/cherry-picked (RBAC tests pass)
2. Railway project is created and identified as staging-only
3. Staging PostgreSQL is provisioned
4. All REQUIRED secrets are set in Railway UI
5. `SAFE_TO_PROCEED_TO_STAGING` is confirmed by Agent 1

## Local Verification Checklist (Complete)

- [x] `pnpm install --frozen-lockfile` - PASS
- [x] `pnpm run build` - PASS (all 4 packages)
- [x] `pnpm run lint` - PASS
- [x] `pnpm run test` - 173/175 API tests pass, 2 RBAC failures (upstream)
- [x] API binds to `0.0.0.0` - FIXED
- [x] Health endpoints implemented - VERIFIED
- [x] Dockerfiles use multi-stage builds - VERIFIED
- [x] Railway configuration created - DONE
- [x] Environment inventory documented - DONE
- [x] Migration strategy documented - DONE
- [x] Rollback plan documented - DONE