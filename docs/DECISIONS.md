# SBOS — Architecture Decision Record

Chronological log of notable engineering decisions and their rationale.

## ADR-001 — Monorepo with pnpm + Turborepo
**Decision:** Single repository with pnpm workspaces and Turborepo task
orchestration. **Why:** shared types/config, atomic cross-cutting changes,
cached incremental builds, one dependency graph. **Status:** adopted.

## ADR-002 — Pin TypeScript 5.7 for apps (web/api)
**Context:** the workspace root ships `typescript@7` (the native `tsgo`
preview), which the Next.js and NestJS toolchains do not yet support.
**Decision:** apps and the database package pin `typescript@^5.7`; the
node-library packages may use 7. **Why:** guarantees reliable builds today
without blocking on toolchain compatibility. **Status:** adopted; revisit when
TS 7 stabilizes.

## ADR-003 — Tailwind CSS v3 (not v4)
**Decision:** use Tailwind v3 with the shadcn/ui token system. **Why:** best
compatibility with the current shadcn component set and PostCSS pipeline.
**Status:** adopted.

## ADR-004 — Self-contained web auth via `jose` + httpOnly cookie
**Decision:** implement the web session as a signed JWT (`jose`) in an httpOnly
cookie, enforced by edge middleware, with a temporary dev credential store.
**Why:** fully buildable and production-viable now; aligns with the API's JWT
model and will be re-pointed at the API in Phase 5. **Status:** adopted
(interim credential store to be removed).

## ADR-005 — Mark `Button` as a client component
**Context:** `@radix-ui/react-slot@1.3.1` calls `React.createContext` at module
load without a `"use client"` directive, which breaks when pulled into the RSC
server graph. **Decision:** add `"use client"` to the `Button` wrapper.
**Why:** keeps Slot on the client boundary; standard shadcn/Next 15 remedy.
**Status:** adopted.

## ADR-006 — Global NestJS guard order: Throttler → JWT → Roles
**Decision:** register guards globally in that order via `APP_GUARD`.
**Why:** rate-limit before auth work; authenticate before authorizing.
`@Public()` opts routes out of JWT; `@Roles()` drives RBAC. **Status:** adopted.

## ADR-007 — Hierarchical RBAC
**Decision:** roles form an ordered hierarchy; a higher role satisfies any
lower role requirement. **Why:** avoids enumerating every allowed role on each
endpoint and matches real practice authority. **Status:** adopted.

## ADR-008 — Multi-tenancy via `organizationId` column
**Decision:** row-level tenancy — every tenant-scoped table carries
`organizationId`; queries are scoped to the caller's organization. **Why:**
simpler operations than schema-per-tenant at this stage; clear upgrade path.
**Status:** adopted.

## ADR-009 — Generate initial migration via `prisma migrate diff`
**Context:** no PostgreSQL instance available in the build environment.
**Decision:** produce the initial migration SQL from the schema using
`migrate diff --from-empty --script`. **Why:** yields a real, deployable
migration without a live database; applied later with `migrate deploy`.
**Status:** adopted.

## ADR-010 — Deterministic `lint` = `tsc --noEmit`
**Decision:** use `tsc --noEmit` as the lint/typecheck task (web included)
instead of `next lint`. **Why:** `next lint` triggers interactive ESLint setup
in a fresh project and is non-deterministic in CI. **Status:** adopted; a flat
ESLint config can be layered in later.

## ADR-011 — Client deletion: hard-delete cascade vs. soft-delete
**Context:** `Client` deletion currently `onDelete: Cascade`s through the full
clinical record (notes, treatment plans, diagnoses, medications, admissions,
assessments) and financial record (insurance policies, claims, invoices,
payments) — see `docs/DECISION_MEMO_CLIENT_DELETE.md` for the full analysis.
**Decision:** not yet made — this is a retention/compliance call, not an
engineering one. **Status:** proposed; recommendation in the linked memo is a
dedicated `deletedAt` soft-delete field (not reusing `Client.status`), with
hard delete reserved for a separate, rarely-used, `SUPER_ADMIN`-gated purge
path once a real retention timeline is set.
