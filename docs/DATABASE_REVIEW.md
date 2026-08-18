# SBOS — Database Review

Production readiness review of the Prisma + PostgreSQL data layer.

## Index optimization

- **Every foreign key is indexed** (Prisma does not auto-index FKs), preventing
  slow joins and lock escalation on cascading deletes.
- **Natural keys are uniquely constrained**: `(organizationId, mrn)` on Client,
  `(organizationId, email)` on User, `(organizationId, claimNumber)` on Claim,
  `(organizationId, invoiceNumber)` on Invoice, `(noteId, version)` on
  NoteVersion, plus per-tenant unique names on Payer/ServiceCode/NoteTemplate/
  FeatureFlag.
- **Composite indexes added for hot multi-tenant query paths**
  (`20260726000000_composite_indexes`):
  | Table | Index | Serves |
  | --- | --- | --- |
  | Appointment | `(organizationId, clinicianId, startTime)` | Double-book conflict check |
  | Appointment | `(organizationId, startTime)` | Calendar / date-range queries |
  | Note | `(organizationId, clientId)` | Client chart notes |
  | Note | `(organizationId, status)` | Co-sign queue |
  | Client | `(organizationId, status)` | Roster filtered by status |
  | Claim | `(organizationId, status)` | Claims worklist |
  | Task | `(organizationId, status)` | Task worklists |

These match the `where`/`orderBy` shapes in the corresponding services and keep
tenant-scoped reads index-only where possible.

## Foreign keys & referential integrity

- All relations are backed by real foreign keys (Prisma relations map to FK
  constraints in PostgreSQL).
- **Cascade policy:**
  - Deleting an **Organization** cascades to all tenant-scoped rows
    (`onDelete: Cascade`) — clean tenant offboarding.
  - Deleting a **Client** cascades to that client's clinical/billing records
    at the schema/FK level (`onDelete: Cascade`, unchanged) -- but as of the
    2026-08-18 hardening session, `ClientsService.remove()` no longer issues
    a real `DELETE` at all; it soft-deletes (`deletedAt`), so this cascade is
    no longer reachable through the normal API. Same applies to **Document**
    (soft-deleted, no cascade children). See `docs/DECISIONS.md` ADR-011/
    ADR-013 and `docs/CURRENT_STATUS.md` for the full retention rationale.
  - Deleting a **Note** cascades to its structured detail (BIRP/DAP/SOAP) and
    versions.
  - **Optional** references use `onDelete: SetNull` (e.g. a client's primary
    clinician, an appointment's location, a payment's invoice/claim) so removing
    an optional parent never destroys the child.

## Data-type & correctness review

- Money is `Decimal(12,2)` (never floating point). Application code rounds to
  cents before persistence.
- Timestamps are UTC; `createdAt`/`updatedAt` are managed by Prisma.
- Enumerated states use PostgreSQL enums (32 enums) rather than free strings.
- JSONB is used for flexible payloads (note version snapshots, assessment
  responses, audit metadata, Jessie prompt structures).

## Performance safeguards

- Pagination is capped (`limit` max 100) on all list endpoints.
- List queries run `count` + `findMany` in a single `Promise.all`.
- Tenant scoping (`organizationId`) is applied on every query, keeping working
  sets small and index-selective.

## Migration audit

- **7 migrations**, all **additive and backwards-compatible** (new tables,
  columns, enums, and indexes only — no destructive `DROP`/`ALTER TYPE` on
  populated columns):
  1. `20260724000000_init` — 29 tables, 89 indexes, 63 FKs
  2. `20260725000000_clinical_versions_templates`
  3. `20260725100000_scheduling`
  4. `20260725200000_billing`
  5. `20260725300000_jessie_ai`
  6. `20260725400000_feature_flags`
  7. `20260726000000_composite_indexes`
- Generated deterministically via `prisma migrate diff`; a `migration_lock.toml`
  pins the `postgresql` provider.
- **Verified applied end-to-end** against a real PostgreSQL 18 instance, then
  seeded and exercised through the API and web app.

## Recommendations tracked for later

- Add partial indexes for very large tenants (e.g. active-only client index) if
  row counts warrant it.
- Consider table partitioning for `AuditLog` and `ConversationMessage` at scale.
- Introduce a read replica + connection pooler (PgBouncer) for high-traffic
  deployments.
