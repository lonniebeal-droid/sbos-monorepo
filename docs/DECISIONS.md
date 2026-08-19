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
**Decision:** soft-delete via a dedicated `deletedAt` field (not reusing
`Client.status`), with hard delete reserved for a separate, rarely-used,
`SUPER_ADMIN`-gated purge path once a real retention timeline is set.
**Status:** adopted and implemented — `9fde323`. `Client.deletedAt` +
composite index (migration `20260818220000_client_soft_delete`),
`ClientsService.remove()`/`findAll()`/`findOne()` updated, `includeDeleted`
gated server-side to `ORG_ADMIN`/`SUPER_ADMIN`. **Applied and verified live
2026-08-19** against a local Postgres (`postgres:16-alpine` via `docker run`,
compose plugin unavailable in this environment) — `prisma migrate deploy`
applied cleanly, `\d "Client"` confirms the `deletedAt` column and
`Client_organizationId_deletedAt_idx` index exist, seed ran, and the API
booted with `PrismaService` reporting "Connected to the database" (the
first time this session with a real connection, not the no-DB warning
path). Not yet applied to any staging/production database.

## ADR-012 — Hard-delete endpoint audit (repo-wide)
**Context:** following ADR-011, audited every `@Delete(` endpoint across
`apps/api/src/modules` for the same class of risk — see
`docs/AUDIT_HARD_DELETE_ENDPOINTS.md` for the full findings.
**Decision:** report only, no code changes. Two findings raise the same
category of concern as `Client`: `TreatmentPlan` delete cascades into
`Goal`/`Objective`, and `Document` delete also permanently removes the
underlying stored file. Both need a retention/compliance decision, not a
mechanical fix. A third finding (five delete endpoints missing audit-log
calls) matches the established low-risk audit-logging pattern but was left
unfixed as out of this task's scope. **Status:** proposed — no action taken;
billing, messaging, organizations, and users modules confirmed to have zero
delete endpoints (safe by omission).

## ADR-013 — Retention implementation package (Client, TreatmentPlan, Document)
**Context:** consolidates ADR-011 and ADR-012 into one implementation-ready
package — see `docs/RETENTION_IMPLEMENTATION_PACKAGE.md` for the full detail.
**Decision:** Client's soft-delete plan is finalized (two previously-open
questions resolved: direct `GET /clients/:id` 404s for non-admins on a
soft-deleted record; MRN uniqueness stays enforced against soft-deleted rows
for v1). `TreatmentPlan` and `Document` are each presented with three options
(A: soft-delete: B: restrict/rely on existing lifecycle; C: narrow guard) and
not yet decided — awaiting approval. Also corrects ADR-012 finding 2: the
currently-bound `LocalStorageProvider.remove()` is a documented no-op, so
Document hard-delete today only removes the DB row, not file bytes — no
production storage provider exists in the repo yet. **Status:** adopted and
implemented. Final choices: Client — soft-delete (see ADR-011, `9fde323`);
TreatmentPlan — Option C, block hard delete unless `status === 'DRAFT'`, no
schema change (`1255c85`); Document — Option A, soft-delete + stop calling
`storage.remove()` on delete (`0488bd5`, migration
`20260818223000_document_soft_delete`). **Applied and verified live
2026-08-19** — see ADR-011 for the local-Postgres setup; `\d "Document"`
confirms `deletedAt` and `Document_organizationId_deletedAt_idx` exist.
TreatmentPlan needed no migration (Option C is service-layer only). Not
yet applied to any staging/production database.

## ADR-014: No dedicated audit entry for a blocked TreatmentPlan delete attempt

**Context:** `TreatmentPlansService.remove()` (Option C, ADR-013) throws
`ForbiddenException` before any Prisma call when a non-`DRAFT` plan's delete
is attempted, so the denial itself is never written to `AuditLog` — only a
successful delete is. Raised as a repo-side follow-up after Claude A's
independent code review of `1255c85` flagged it as a gap.

**Finding:** no "denied/rejected action" audit pattern exists anywhere in
this codebase to extend. Checked both places: (1) the `AuditAction` enum in
`schema.prisma` has exactly nine values — `CREATE, READ, UPDATE, DELETE,
LOGIN, LOGOUT, EXPORT, SIGN, SUBMIT` — none represent a denial/rejection; (2)
`NotesService.remove()`, the exact DRAFT-only guard `TreatmentPlansService`
was built to mirror, has the identical gap — it also throws
`ForbiddenException` on a non-`DRAFT` note with no audit call before the
throw. So this isn't a regression specific to the TreatmentPlan work; it's a
pre-existing, repo-wide absence of denied-action auditing.

**Decision:** do not invent a new `AuditAction` value or ad-hoc metadata
convention unilaterally in this pass. Adding one correctly (e.g. a new
`DENY`/`REJECT` enum value, or overloading `metadata` on an existing action)
is a schema and cross-cutting-convention decision, not a narrow bug fix, and
it should apply consistently to every guarded delete/write in the codebase
(`NotesService.remove()`, `TreatmentPlansService.remove()`, and any future
ones) rather than be bolted onto one service. Flagging for approval before
any implementation.

**Status:** approved and implemented. Added `DENY` to the `AuditAction` enum
(migration `20260818230000_audit_action_deny`, additive-only --
`ALTER TYPE "AuditAction" ADD VALUE 'DENY'`, no existing rows/values
touched). Both `TreatmentPlansService.remove()` and `NotesService.remove()`
now call `audit.record({ action: AuditAction.DENY, ... })` with
`metadata: { attemptedAction: 'DELETE', reason: 'not DRAFT', status }`
before throwing `ForbiddenException`, so a blocked delete attempt is now
traceable the same way a successful one is. **Applied and verified live
2026-08-19** — `SELECT enumlabel FROM pg_enum WHERE enumtypid =
'"AuditAction"'::regtype` confirms `DENY` is present alongside the original
nine values, in a local Postgres (see ADR-011 for setup detail). Not yet
applied to any staging/production database.
