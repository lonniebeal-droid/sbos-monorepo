# SBOS — Current Status

_Last updated: 2026-07-24_

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
- The **Clients** page reads live data from the API with graceful empty/error
  states. Verified end-to-end (API + web running): login proxies to the API,
  cookies set, bad creds → 401, protected routes redirect, logout clears
  cookies, pages degrade gracefully when the API has no database.

## Next recommended phase

**Phase 5 — Authentication & tenancy hardening**: connect web ↔ API auth,
add Organization/Location CRUD, and implement MFA. Then proceed down the
priority list (client management → scheduling → documentation → AI → billing).

## Known issues / notes

- **No live database in this environment** — migrations and seed are prepared
  but not applied; they require a running PostgreSQL and `DATABASE_URL`.
- **Interim web credential store** — `apps/web/src/lib/dev-users.ts` exists for
  local sign-in until API auth is wired; not used in production paths.
- **Prisma deprecation warning** — `package.json#prisma` seed config warns it
  will move to `prisma.config.ts` in Prisma 7 (non-blocking).
- **Root `typescript@7`** is the native preview; apps intentionally pin 5.7
  (see ADR-002).
- **ESLint** not yet configured; `tsc --noEmit` serves as the lint gate.
