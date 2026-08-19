# SBOS — Current Status

_Last updated: 2026-07-24. See "Backend hardening session (2026-08-18)" below
for what's changed since — the phase history above predates it and is kept
as-is for historical record; it is not stale, just incomplete past that date._

## What was completed

- **Phase 1 — Web (`apps/web`)**: Next.js 15 App Router app; Tailwind v3 +
  shadcn/ui component library (14 primitives); JWT cookie auth with edge
  middleware; responsive dashboard shell (sidebar, header, mobile nav); dark
  mode; TanStack Query + React Hook Form + Zod. 15 routes.
- **Phase 2 — API (`apps/api`)**: NestJS 10 REST API; Swagger at `/docs`;
  JWT access+refresh; hierarchical RBAC; global validation, throttling, CORS;
  auth/users/health endpoints.
- **Phase 3 — Database (`packages/database`)**: Prisma + PostgreSQL schema
  (29 models, 32 enums); generated client singleton; deployable initial
  migration (29 tables, 89 indexes, 63 FKs); idempotent seed.
- **Phase 4 — Dashboard modules**: Schedule, Calendar (month grid), Clients
  (roster/search), Clinical Notes (+ interactive BIRP/DAP/SOAP composer),
  Billing (claims/invoices), Reports (KPIs/utilization), Settings (tabbed).

## What is currently working

- `pnpm turbo run build` — **5/5 packages build**.
- `pnpm turbo run lint` — **6/6 typecheck clean**.
- API boots and was smoke-tested live: health OK, login issues JWTs,
  authenticated profile works, RBAC returns 403 for under-privileged roles,
  unauthenticated returns 401, Swagger serves 200.
- Web app produces an optimized production build; all routes compile; auth
  middleware bundles.
- Prisma schema validates; client generates; migration SQL generated.

## Remaining work

- Wire the web app's auth and data flows to the live API (remove the interim
  dev credential store).
- Implement resource APIs (Organizations, Clients, Appointments, Notes,
  Billing, …) backed by Prisma.
- Stand up PostgreSQL and run `migrate deploy` + `db:seed` in a real env.
- Add MFA, refresh-token rotation, organization/location management.
- Background jobs (Redis/BullMQ), storage (S3), realtime (WebSockets),
  payments (Stripe), email/SMS, and the AI layer ("Jessie").
- CI (GitHub Actions), Docker, HIPAA controls.

## Phase 5 — Auth & tenant management (done)

- Global `PrismaModule`/`PrismaService` wired into the API (non-fatal startup).
- **Organizations** (get/update/stats), **Locations** CRUD, **Clients** CRUD,
  **Appointments** CRUD with conflict detection — tenant-scoped, RBAC-guarded.

## Phase 6 — Clinical platform (done)

- **Clinical Notes**: BIRP/DAP/SOAP/progress/group; draft→sign→co-sign→amend
  workflow; **version history**; **audit trail** (AuditModule); AI-assisted
  drafts via the **Jessie** note-assistant (AiModule, provider-swappable).
- **Diagnoses**, **Medications**, **Treatment Plans** (goals/objectives),
  **Documents** (StorageModule with presigned upload/download + e-sign).
- Shared domain rules moved to `@sbos/core` (RBAC + note transitions) with
  passing unit tests; API guards/services consume them (no duplication).
- Schema: added `NoteVersion` + `NoteTemplate` (migration
  `20260725000000_clinical_versions_templates`).
- Verified: 55 routes across 12 groups; build 5/5, lint 7/7, test 6/6.

## Phase 7 — Scheduling (done)

- **Recurring appointments** (series generation with conflict skipping),
  **telehealth session** provisioning, and appointment **lifecycle**
  (check-in → check-out → complete, cancel with reason).
- **Clinician availability** (weekly windows) + **time-off**, with an
  **open-slot computation** endpoint (availability minus booked minus time-off).
- **Waitlist** with priority and status transitions.
- Recurrence/overlap/slot logic added to `@sbos/core` with unit tests
  (10 assertions total). Schema: `ClinicianAvailability`, `ClinicianTimeOff`,
  `WaitlistEntry` + `checkedOutAt` (migration `20260725100000_scheduling`).
- Verified: 68 routes across 13 groups; build 5/5, lint 7/7, test 6/6.

## Phase 8 — Billing (done)

- **Payers** and a **CPT fee schedule** (ServiceCode); **Claims** lifecycle
  (draft → submit → accept/deny/pay, ERA/EOB posting); **Invoices** with line
  items and auto-computed totals; **Payments** through a provider abstraction
  (`PAYMENT_PROVIDER`; manual default, Stripe-swappable) that reconciles invoice
  balances; **Superbill** generation for a client/date range.
- Schema: `Payer`, `ServiceCode` (migration `20260725200000_billing`).
- Verified: 86 routes across 14 groups; build 5/5, lint 7/7.

## Phase 9 — Jessie AI platform (done, credential-free)

- Provider-abstracted assistant layer (`CHAT_PROVIDER`) with an offline
  deterministic default and an LLM-swappable seam — architected to be licensed
  independently of SBOS.
- **Conversations** with persisted **memory**, a multi-assistant **router**
  (receptionist / scheduling / intake / clinical / knowledge / general),
  **admin prompt management** (per-kind, versioned), and a **knowledge base**
  with grounding retrieval. AI actions written to the audit trail.
- Schema: `Conversation`, `ConversationMessage`, `PromptTemplate`,
  `KnowledgeArticle` (migration `20260725300000_jessie_ai`).
- Verified: 98 routes across 15 groups; build 5/5, lint 7/7, test 6/6.
- Live AI/voice/SMS providers (OpenAI/Claude/Gemini, Twilio, Resend) plug into
  the existing interfaces once credentials are supplied.

## Phase 10 — Enterprise (done)

- **Task management** (assign, prioritize, complete), **Notifications**
  (per-user, unread count, mark read/all; global service other modules emit to),
  **Internal messaging** (threads/participants/messages with read markers),
  **Analytics** (practice KPI overview + appointment/claim status reporting),
  **Feature flags** (per-tenant toggles), and an admin **system-health**
  dashboard (DB probe, counts, uptime, memory).
- Schema: `FeatureFlag` (migration `20260725400000_feature_flags`).
- Verified: 117 routes across 20 groups; build 5/5, lint 7/7, test 6/6.

## Web ↔ API integration (done)

- The web app now authenticates against the **live NestJS API** (`/auth/login`),
  storing a web session cookie plus API access/refresh tokens; **middleware
  refreshes** the access token as it nears expiry.
- Interim dev credential store (`dev-users.ts`) **removed** — auth is fully
  API-backed. Added a typed server-side **API client** (`src/lib/api.ts`) with
  error normalization and pagination types.
- **All seven dashboard modules now read live data** from the API — Dashboard
  (analytics KPIs + today's appointments + tasks), Schedule, Calendar, Clients,
  Clinical Notes, Billing (claims + analytics), Reports (analytics), and
  Settings (organization + team) — each with graceful empty/error states via a
  shared `tryApiFetch` wrapper and `ApiErrorBanner`/`EmptyState` components.
- Verified end-to-end (API + web running): login proxies to the API, cookies
  set, bad creds → 401, protected routes redirect, logout clears cookies, and
  all eight authenticated pages render 200 while degrading gracefully when the
  API has no database.

## Write actions (done)

- **Create/update flows** via Next.js **Server Actions** that call the API and
  revalidate the affected routes: **New Client** (dialog form), **New
  Appointment** (dialog with client/clinician pickers + conflict-checked
  scheduling), and **Save Organization** settings. Forms use React Hook Form +
  Zod with pending state and success/error toasts.
- Added `GET /api/v1/clinicians` (list) to populate the appointment picker
  (118 total routes). Verified: all write-action pages render 200; actions
  surface API errors gracefully.

## Containerization & CI (done)

- **Multi-stage Dockerfiles** for the API and web, using **Turborepo pruning**
  for optimal layer caching; the web image runs the **Next.js standalone**
  server, the API image applies Prisma migrations on start.
- **docker-compose.yml**: PostgreSQL + Redis + API + web with health checks and
  a persistent DB volume; `.env.docker.example` for secrets.
- **GitHub Actions CI** (`.github/workflows/ci.yml`): build/lint/test plus
  Docker image builds on every push/PR.
- Verified locally: web **standalone bundle boots** and serves pages (the exact
  runtime the container executes); full workspace build 5/5, lint 7/7. Docker
  image builds run in CI (no local Docker daemon in this environment).

## Live data & provider integrations (done)

- **Full stack verified against a real PostgreSQL** (via an embedded Postgres in
  this environment): all 6 migrations applied, database seeded, and the web app
  rendering live data end-to-end — login → API auth (now Prisma-backed) → live
  clients, dashboard KPIs, and client chart; note create → sign → version
  history; client create — all persisted.
- **Live provider adapters, config-selected** (activate on key, offline default
  otherwise): **Jessie chat** (OpenAI-compatible LLM ↔ heuristic), **payments**
  (Stripe ↔ manual), **email** (Resend ↔ console), **SMS** (Twilio ↔ console).
  Verified the selection switches correctly with/without keys. Wired real uses:
  welcome email on client creation, confirmation SMS on appointment creation.

## Production readiness pass (done)

- **Security:** Helmet headers, global consistent-error filter, fail-fast config
  validation, login rate-limit (5/min), CORS methods; OWASP Top 10 review.
- **Database:** composite indexes for hot paths; full FK/cascade/migration audit
  (`docs/DATABASE_REVIEW.md`).
- **API:** complete OpenAPI (error schema, standard 401/429, metadata, `/docs/json`).
- **Frontend:** route-group loading skeletons; a11y (skip link, landmarks,
  aria-current, labeled controls).
- **Deployment:** non-root containers + HEALTHCHECKs, web health endpoint,
  compose secret enforcement + provider passthrough, `.env.production.example`.
- **Docs:** INSTALL, DEPLOYMENT, ADMIN_GUIDE, API_GUIDE, AI_CONFIGURATION,
  SECURITY, plus `RELEASE_1_CHECKLIST.md`.

## RC1 review & master plan (done)

- Added **PROJECT_MASTER_PLAN.md** as the canonical roadmap (architecture,
  feature matrix, roadmaps, technical debt, compliance).
- **Repository review + cleanups:** removed dead `ROLE_HIERARCHY`, removed the
  leftover `apps/service-operations` scaffolding (and its example primitives),
  and unified duplicated money rounding into `@sbos/core#roundCurrency` (tested).
  Confirmed **zero real TODO/FIXME comments** in the codebase.

## Autonomous hardening session (done)

- **MFA (TOTP):** enrollment (QR), enable/disable, two-step login (API + web),
  verified end-to-end.
- **Refresh-token rotation + revocation + reuse detection** (new `RefreshToken`
  table); logout revokes; verified.
- **API unit tests (Vitest):** MfaService, RolesGuard, AllExceptionsFilter,
  NotesService, pagination — 17 tests (plus 12 in `@sbos/core`).
- **Clinical note composer** wired to the API: client/clinician pickers, "Generate
  with Jessie" AI drafting, and persistence via `POST /notes`.
- **Structured request-logging interceptor** (method/path/status/duration/user).
- RC1 cleanups: removed dead code + leftover app, unified money rounding.

## Next recommended phase

**Phase 5 — Authentication & tenancy hardening**: connect web ↔ API auth,
add Organization/Location CRUD, and implement MFA. Then proceed down the
priority list (client management → scheduling → documentation → AI → billing).

## Backend hardening session (2026-08-18)

Not a new phase — a repo-wide hardening pass on the existing API, done
incrementally with build/lint/test/boot verification and its own commit per
change (full detail: `docs/DECISIONS.md`, `docs/AUDIT_HARD_DELETE_ENDPOINTS.md`).

- **RBAC/tenant-scope fixes:** missing `WaitlistEntry`/`ClinicianAvailability`/
  `ClinicianTimeOff` → `Organization` FKs added; task deletion restricted to
  supervisor and above.
- **Audit-log coverage:** every hard-delete endpoint in the API now writes an
  `AuditLog` entry on delete — clients, billing (payers/fee schedules),
  appointments, notes, documents, diagnoses, medications, locations,
  treatment-plans, scheduling (availability/waitlist), tasks, and Jessie
  knowledge-base articles are all covered. A *blocked* (denied) delete
  attempt is covered too: `docs/DECISIONS.md` ADR-014 (approved, implemented
  `bba6ca7`) added a `DENY` `AuditAction` and wired it into both
  `TreatmentPlansService.remove()` and `NotesService.remove()`'s DRAFT-only
  guards, so a rejected delete is now traceable, not just a successful one.
- **Client/TreatmentPlan/Document retention:** replaced Client's and
  Document's hard `.delete()` with a soft-delete (`deletedAt`, additive
  migrations `20260818220000_client_soft_delete` and
  `20260818223000_document_soft_delete`); TreatmentPlan hard-delete is now
  blocked unless `status === 'DRAFT'`. All default read paths (list, search,
  direct fetch) exclude soft-deleted rows; `ORG_ADMIN`/`SUPER_ADMIN` can opt
  into seeing deleted Clients via `?includeDeleted=true`. Dashboard/analytics
  client counts (`OrganizationsService.stats()`, `SystemHealthService.snapshot()`,
  `AnalyticsService.overview()`) were also found and fixed to exclude
  soft-deleted rows. Full decision record: ADR-011/ADR-013 in `docs/DECISIONS.md`.
- **Still blocked:** the three migrations below have not been applied to any
  reachable PostgreSQL — no live database in this environment (same standing
  limitation noted below), so this is unchanged, not new.

## Known issues / notes

- **No live database in this environment** — migrations and seed are
  prepared but not applied. Confirmed again 2026-08-19: no `.env`/
  `DATABASE_URL` configured, `localhost:5432` unreachable, and the local
  Docker daemon (which would run `docker-compose.yml`'s `postgres` service)
  is not running — not started, since this environment's disk is very tight
  (~3GB free) and starting it is a real environment change, not just a
  reachability check. Three migrations from the 2026-08-18/19 hardening
  session are pending, on top of everything from `20260724000000_init`
  onward: `20260818220000_client_soft_delete`, `20260818223000_document_soft_delete`,
  `20260818230000_audit_action_deny`. Exact command once a real
  `DATABASE_URL` is reachable:
  ```
  cd packages/database && DATABASE_URL=<real-postgres-url> npx prisma migrate deploy
  ```
  followed by `pnpm --filter @sbos/database db:seed` if a fresh/empty database.
- **Interim web credential store** — `apps/web/src/lib/dev-users.ts` exists for
  local sign-in until API auth is wired; not used in production paths.
- **Prisma deprecation warning** — `package.json#prisma` seed config warns it
  will move to `prisma.config.ts` in Prisma 7 (non-blocking).
- **Root `typescript@7`** is the native preview; apps intentionally pin 5.7
  (see ADR-002).
- **ESLint** not yet configured; `tsc --noEmit` serves as the lint gate.
