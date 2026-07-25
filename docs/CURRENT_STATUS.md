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
