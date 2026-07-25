# SBOS — Project Status

_Last updated: 2026-07-25_

SBOS (Success Brand Operating System) is a **multi-tenant SaaS behavioral-health
operating system**. It is a product in its own right; **SuccessBrand is Tenant
#1**, not the subject of the platform. There is no hardcoded tenant logic —
every table and endpoint is scoped by `organizationId` and supports unlimited
organizations, locations, staff, clinicians, clients, roles, and permissions.
**Jessie AI** is the platform's proprietary AI layer, architected as a
provider-abstracted module so it can eventually be licensed independently.

## Delivered

### Platform & architecture
- pnpm + Turborepo monorepo: `apps/web`, `apps/api`, `packages/database`,
  `packages/core`, `packages/tsconfig`.
- Shared domain logic in `@sbos/core` (RBAC + note rules) with unit tests —
  no duplicated business logic across services.
- Multi-tenant row isolation (`organizationId`) across all 31 data models.

### Web (`apps/web`) — Next.js 15
- Auth (JWT cookie + edge middleware), responsive dashboard shell, dark mode.
- Seven modules: Schedule, Calendar, Clients, Clinical Notes (interactive
  BIRP/DAP/SOAP composer), Billing, Reports, Settings.

### API (`apps/api`) — NestJS 10 (`/api/v1`, Swagger at `/docs`)
- **55 routes** across 12 resource groups.
- Auth (JWT access+refresh), hierarchical RBAC, validation, rate limiting.
- Prisma-backed, tenant-scoped: Organizations, Locations, Clients,
  Appointments (conflict detection), **Clinical Notes** (BIRP/DAP/SOAP/progress/
  group; draft→sign→co-sign→amend; version history; audit trail; AI draft),
  Diagnoses, Medications, Treatment Plans (goals/objectives), Documents
  (presigned upload/download, e-sign).
- Cross-cutting modules: **AuditModule** (immutable trail), **AiModule**
  (Jessie note-assistant, provider-swappable), **StorageModule** (S3-swappable).

### Database (`packages/database`) — Prisma + PostgreSQL
- 31 models, 27 enums; two migrations (initial + note versions/templates).
- Generated client singleton; idempotent dev seed.

## In progress / next
- Phase 7 Scheduling depth (recurrence, availability, waitlist, check-in,
  telehealth sessions, calendar sync architecture).
- Phase 8 Billing (payers, CPT/ICD, claims, invoices, payments, superbills,
  ERA/EOB, Stripe architecture).
- Phase 9 Jessie AI expansion (receptionist, scheduling, intake, clinical
  assistant, knowledge base, voice/chat, workflow automation, analytics).
- Phase 10 Enterprise (analytics, notifications, messaging, tasks, file mgmt,
  feature flags, system health).
- Wire web ↔ API auth; remove interim dev credential stores; MFA (TOTP).

## Known issues / notes
- **No live database in this environment**: migrations/seed are prepared but not
  applied; DB-backed endpoints error until `DATABASE_URL` targets a reachable
  PostgreSQL. The API boots without a DB by design.
- **Interim dev credential stores** (`apps/api/.../users.service.ts` seed,
  `apps/web/src/lib/dev-users.ts`) exist for local sign-in only; they are not
  tenant logic and will be replaced when web↔API auth is wired.
- **External integrations** (Stripe, Twilio, Resend, hosted LLM providers) are
  architected behind interfaces but require credentials to activate.
- Prisma `package.json#prisma` seed-config deprecation warning (non-blocking).

## Verification (latest)
- `turbo run build` → 5/5 · `turbo run lint` → 7/7 · `turbo run test` → 6/6
  (5 unit assertions in `@sbos/core`).
- API boots without a DB; 55 routes mapped across 12 groups.
