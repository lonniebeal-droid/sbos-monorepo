# SBOS — Production Readiness Checklist

A launch-focused checklist organized by infrastructure concern, for whoever
is taking SBOS from "clone and run locally" to "live in production." This
complements — it does not replace — [`RELEASE_1_CHECKLIST.md`](../RELEASE_1_CHECKLIST.md)
(the code-quality/feature-complete release gate) and [`docs/SECURITY.md`](SECURITY.md)
(the full security posture). Legend: ✅ done in code today · ⬜ operator
action required · 🔶 a decision is needed, not just an action.

---

## 1. Environment Variables

No `.env` files exist in a fresh clone — every value below either has a safe
development default in code, or must be set explicitly. Full lists live in
`apps/api/.env.example`, `apps/web/.env.example`, `packages/database/.env.example`.

| Variable | Used by | Required in prod? | Dev default |
| --- | --- | --- | --- |
| `DATABASE_URL` | api, database pkg | ✅ required | none — must be set to *some* value even locally (Prisma throws at client construction if entirely absent) |
| `JWT_ACCESS_SECRET` | api | ✅ required, must differ from refresh | `sbos-dev-access-secret-change-me` |
| `JWT_REFRESH_SECRET` | api | ✅ required | `sbos-dev-refresh-secret-change-me` |
| `AUTH_SECRET` | web | ✅ required | `sbos-development-secret-change-me-in-production` |
| `CORS_ORIGINS` | api | recommended (exact origin) | `http://localhost:3000` |
| `PORT` | api | optional | `4000` |
| `SBOS_API_URL` / `NEXT_PUBLIC_API_URL` | web | recommended (internal URL in prod) | `http://localhost:4000` |
| `OPENAI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | api | optional — activates live Jessie chat | unset → heuristic offline provider |
| `STRIPE_SECRET_KEY` | api | optional — activates Stripe payments | unset → manual payment provider |
| `RESEND_API_KEY`, `EMAIL_FROM` | api | optional — activates live email | unset → console email provider |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | api | optional — activates live SMS | unset → console SMS provider |

- ⬜ Generate distinct production secrets: `openssl rand -base64 48` for each
  of `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `AUTH_SECRET`.
- ⬜ Store secrets in a managed secret store, not a `.env` file on disk
  (RELEASE_1_CHECKLIST §2).
- 🔶 **`NODE_ENV`** — the API's config validation only hard-fails on
  missing/default secrets when `NODE_ENV=production`; it just warns
  otherwise. Confirmed this session: a shell/CI environment with
  `NODE_ENV=production` already exported (independent of anything the app
  sets) will make even a local `pnpm --filter @sbos/api dev` refuse to boot
  unless real secrets are set. Decide explicitly per environment: set
  `NODE_ENV=production` **and** real secrets for prod, `NODE_ENV=development`
  for local/dev, and never leave it ambient/unset in a prod deploy target.

## 2. Docker Deployment

```bash
cp .env.production.example .env   # fill in the required secrets above
docker compose up --build -d
docker compose ps                 # expect all four services healthy
docker compose logs -f api
```

- ✅ Multi-stage Dockerfiles (Turborepo-pruned) for `api` and `web`, both
  non-root, both with `HEALTHCHECK`s.
- ✅ `web` image runs the Next.js **standalone** server (verified boots).
- ✅ `api` container runs `prisma migrate deploy` automatically on start.
- ✅ `docker-compose.yml` wires postgres → redis → api → web with health-gated
  `depends_on`.
- ⬜ Push built images to a registry for your target platform (Railway / Fly /
  ECS / etc.) — see `docs/DEPLOYMENT.md` Option B for the managed-platform path.
- ⬜ Container image vulnerability scan before first prod push.

## 3. Database Setup

```bash
pnpm --filter @sbos/database prisma:generate
pnpm --filter @sbos/database prisma:deploy   # applies all migrations, idempotent
pnpm --filter @sbos/database db:seed         # DEV/DEMO ONLY — do not run in prod
```

- ✅ 13 additive, backwards-compatible migrations; verified applying cleanly
  against a real local Postgres this session (13/13, `20260724000000_init`
  through `20260818230000_audit_action_deny`).
- ✅ Idempotent seed script (demo org + 2 users) — confirmed live-boot-tested.
- ⬜ Provision a managed PostgreSQL instance for production; set `DATABASE_URL`.
- ⬜ **Do not run `db:seed` against production** — it creates the demo org and
  the publicly-documented demo credentials above.
- ⬜ Automated backups + a tested restore procedure (none exist yet).
- ⬜ Connection pooler (PgBouncer) + read-replica sizing once load is known.

## 4. Redis Decision

`docker-compose.yml` provisions a `redis:7-alpine` service and the API's
Dockerfile/compose config pass through a `REDIS_URL`-shaped environment
block, but **no code in `apps/api/src` currently reads `REDIS_URL` or uses
Redis for anything** (confirmed by search this session — zero references).
This is a real decision point, not just a TODO:

- 🔶 **Option A — remove it**: drop the `redis` service from
  `docker-compose.yml` until there's a concrete consumer (rate-limit storage,
  BullMQ job queue, or a cache). Simplest; avoids running unused
  infrastructure in prod.
- 🔶 **Option B — implement its first consumer before launch**: the most
  likely first use is **distributed rate-limit storage** for `@nestjs/throttler`
  (today's rate limiting is in-memory, which doesn't work correctly across
  multiple API replicas) — worth doing before horizontally scaling the API.
- Either way, this should be an explicit decision before production, not an
  accidental unused container shipping by default.

## 5. Security Checklist

Full detail: [`docs/SECURITY.md`](SECURITY.md) (OWASP Top 10 review included).
Condensed for launch:

- ✅ JWT access+refresh (separate secrets), bcrypt passwords, MFA (TOTP)
- ✅ Refresh-token rotation + revocation + reuse detection
- ✅ Six-role RBAC + multi-tenant `organizationId` scoping on every query
- ✅ Global input validation (whitelist + forbid-unknown DTOs)
- ✅ Rate limiting (120/min global, 5/min login) — see the Redis decision above
- ✅ Helmet headers, CORS allowlist, HttpOnly/Secure/SameSite cookies in prod
- ✅ Fail-fast config validation in production (see NODE_ENV note above)
- ✅ Consistent error envelope (no stack traces to clients); immutable audit log
- ⬜ Encryption at rest for PHI + backups (deploy-time, platform-dependent)
- ⬜ Secrets in a managed secret store (not `.env` on disk)
- ⬜ Dependency vulnerability scanning + SAST (CodeQL) in CI
- ⬜ Penetration test before handling real PHI
- ⬜ BAAs signed with any enabled third-party provider (OpenAI/Stripe/Resend/Twilio)

## 6. Logging / Monitoring

- ✅ Structured per-request logging (method/path/status/duration/user) via a
  logging interceptor — ships to container stdout today.
- ✅ Health endpoints: `GET /api/v1/health` (api), `GET /api/health` (web),
  `GET /api/v1/platform/system-health` (authenticated admin snapshot — DB
  probe, table counts, uptime, memory).
- ⬜ Centralized log aggregation + retention policy (ship stdout to your
  provider — Datadog/CloudWatch/Loki/etc.).
- ⬜ Metrics + alerting (uptime, error rate, latency, DB connection health).
- ⬜ Error tracking (e.g. Sentry) for unhandled exceptions on both api and web.
- ⬜ On-call rotation + incident runbook.

## 7. Backups

- ⬜ **None automated today** — this is the single largest operational gap.
- ⬜ Automated PostgreSQL backups (provider-managed snapshots, or
  `pg_dump`/WAL archiving on a schedule) with a defined retention window.
- ⬜ A **tested restore procedure** — a backup that has never been restored is
  not a verified backup.
- ⬜ Backup encryption at rest, consistent with the PHI encryption requirement
  in §5.

## 8. Domain / SSL

- Terminate TLS at the load balancer / platform edge — the app does not
  terminate TLS itself.
- Cookies are issued `Secure` + `HttpOnly` + `SameSite=Lax` automatically
  when `NODE_ENV=production` — confirm this is actually set (see §1).
- ⬜ Provision the production domain + certificate (most managed platforms —
  Railway/Fly/Vercel-style — automate this; self-hosted needs Let's Encrypt
  or equivalent).
- ⬜ Set `CORS_ORIGINS` to the **exact** production web origin(s) — credentials
  are enabled, so a wildcard is not appropriate.
- ⬜ Point `SBOS_API_URL` (web) at the api's real internal/production URL.

## 9. CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `main`:

- ✅ **Build · Lint · Test** job — `pnpm install --frozen-lockfile`, `pnpm build`,
  `pnpm lint`, `pnpm test` across the whole workspace.
- ✅ **Docker image build** job — builds both the `api` and `web` images.
- ⬜ No deploy step yet — CI verifies and builds images but does not push
  them to a registry or deploy them. Add a deploy job (or a separate CD
  pipeline) once a target platform is chosen.
- ⬜ No dependency vulnerability scan (`pnpm audit` / Dependabot) in CI yet.
- ⬜ No SAST (CodeQL) in CI yet.
- ⬜ No container image scan in CI yet.

---

## Go / No-Go Summary

**Already true today (verified live this session):** all packages build
clean, dependencies install clean, both apps boot and serve real traffic
(`/api/v1/health` → 200, `/login` → 200), migrations apply cleanly to a real
Postgres, the demo seed works, and the security/RBAC/audit code paths are all
implemented and exercised.

**Must be closed before handling real PHI in production** (ship-blocking):
managed database + tested backups, production secrets in a real secret store,
TLS + exact `CORS_ORIGINS`, encryption at rest, the Redis decision (§4) if
horizontally scaling, provider BAAs for any live vendor integration enabled,
and a full pre-launch smoke test on a clean host.

**Safe to defer past first launch:** centralized log aggregation/alerting,
error tracking, WCAG full audit, dependency/SAST/image scanning in CI, a
connection pooler.

Everything above is infrastructure provisioning, credentials, or an
operator/compliance decision — not a code gap. The application itself (auth,
RBAC, API, database, containers, CI) is implemented and verified working.
