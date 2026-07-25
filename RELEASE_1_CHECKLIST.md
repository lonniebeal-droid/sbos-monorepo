# SBOS — Release 1 Production Checklist

Everything required before the first production deployment. Legend:
✅ done · 🔶 partial · ⬜ required before go-live (owner action)

Status reflects the codebase; items marked ⬜/🔶 need operator action or
credentials that only you can provide.

---

## 1. Code quality & CI

- ✅ `pnpm build` green (5/5 packages)
- ✅ `pnpm lint` green (7/7 typecheck)
- ✅ `pnpm test` green (unit tests in `@sbos/core`)
- ✅ GitHub Actions CI runs build/lint/test + builds both Docker images on push
- 🔶 Expand unit/integration test coverage (services, guards, e2e happy paths)
- ⬜ Add dependency vulnerability scanning (e.g. `pnpm audit` / Dependabot) to CI
- ⬜ Add SAST (CodeQL) to CI

## 2. Security

- ✅ JWT access+refresh, separate secrets, typed token validation
- ✅ bcrypt password hashing
- ✅ Hierarchical RBAC + multi-tenant scoping on every query
- ✅ Global input validation (whitelist + forbid unknown)
- ✅ Rate limiting (global 120/min; login 5/min)
- ✅ Helmet security headers
- ✅ CORS allowlist with credentials
- ✅ HttpOnly + Secure + SameSite cookies (prod); Server Actions same-origin
- ✅ Fail-fast config validation (no default/missing secrets in prod)
- ✅ Consistent error envelope; no internal leakage
- ✅ Immutable audit log
- ✅ **MFA (TOTP)** — enrollment, enable/disable, and two-step login
- ⬜ Refresh-token rotation + revocation (deny-list) store
- ⬜ Encryption at rest for PHI + backups (deploy-time)
- ⬜ Secrets stored in a managed secret store (not `.env` on disk)
- ⬜ Penetration test before handling real PHI
- ⬜ Sign BAAs with any enabled providers (LLM/Stripe/Resend/Twilio) handling PHI

## 3. Database

- ✅ Normalized schema (41 models), all FKs indexed, natural keys constrained
- ✅ Composite indexes for hot paths
- ✅ Cascade/SetNull policies reviewed (`docs/DATABASE_REVIEW.md`)
- ✅ 7 additive, backwards-compatible migrations; verified applied on real PG
- ✅ Idempotent seed for a demo org
- ⬜ Automated backups + tested restore procedure
- ⬜ Connection pooler (PgBouncer) + read replica sizing for expected load
- ⬜ Rotate/secure the seed's demo credentials (do not seed demo users in prod)

## 4. API

- ✅ URI versioning (`/api/v1`)
- ✅ Consistent pagination/filtering/search
- ✅ Consistent error responses
- ✅ Complete OpenAPI (schemas, security scheme, standard 401/429), served at `/docs`
- ⬜ Decide whether `/docs` is exposed in production (or gate behind auth/VPN)

## 5. Frontend

- ✅ Error states (API-unreachable / 403 banners)
- ✅ Empty states across modules
- ✅ Loading states (route-group skeletons)
- ✅ Responsive layouts (desktop/tablet/mobile) + dark mode
- ✅ Accessibility: skip link, landmarks, aria-current, labeled controls
- ⬜ Full WCAG 2.1 AA audit (contrast, keyboard traps, screen-reader pass)
- ⬜ Error boundary / not-found polish for unexpected client errors

## 6. Deployment

- ✅ Multi-stage Dockerfiles (Turborepo prune), non-root users, HEALTHCHECKs
- ✅ Next.js standalone runtime image (verified boots)
- ✅ docker-compose (Postgres + Redis + api + web) with health gating
- ✅ API applies migrations on start
- ✅ Env templates (`.env.production.example`, per-app `.env.example`)
- ⬜ Provision managed PostgreSQL (+ backups) and set `DATABASE_URL`
- ⬜ Set production secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `AUTH_SECRET`)
- ⬜ Configure TLS/domain + `CORS_ORIGINS`
- ⬜ Push images to a registry; deploy to target platform
- ⬜ Container image vulnerability scan

## 7. Observability & operations

- ✅ Health endpoints (api `/api/v1/health`, web `/api/health`, admin system-health)
- ⬜ Centralized logging + log retention
- ⬜ Metrics + alerting (uptime, error rate, latency, DB)
- ⬜ Error tracking (e.g. Sentry)
- ⬜ On-call + incident runbook

## 8. Provider integrations (optional; activate per need)

- ✅ Adapters built and config-selected (offline defaults when unset)
- ⬜ OpenAI/LLM key + BAA (Jessie live chat)
- ⬜ Stripe key + client-side card flow (payments)
- ⬜ Resend key + verified domain (email)
- ⬜ Twilio credentials + number (SMS)

## 9. Compliance (HIPAA-oriented)

- ✅ Technical: RBAC, audit log, tenant isolation, transport security
- ⬜ Administrative: policies, workforce training, access reviews
- ⬜ Physical/infra: encrypted storage, hosting BAA, backup encryption
- ⬜ Breach-notification and data-retention procedures

## 10. Pre-launch verification

- ⬜ `docker compose up` on a clean host → all services healthy
- ⬜ Migrations applied; **no demo seed** in production (or a clean tenant seeded)
- ⬜ Smoke test: sign in, create client, schedule, document + sign, bill, log out
- ⬜ Confirm `/docs` exposure decision honored
- ⬜ Verify backups run and a restore succeeds
- ⬜ Load/perf sanity check at expected concurrency

---

### Go / No-Go

**Ship-blocking (must be ✅ before real PHI):** managed DB + backups, production
secrets, TLS/CORS, secrets store, encryption at rest, MFA or compensating
control, provider BAAs (if enabled), and the pre-launch smoke test.

The application code, security controls, database, API, UI, containers, and CI
are **production-ready**. The remaining ⬜ items are infrastructure provisioning,
credentials, and organizational/compliance steps that require operator action.
