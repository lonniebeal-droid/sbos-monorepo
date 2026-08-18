# Implementation Plan: Client Soft-Delete

**Status:** plan only — nothing in this document has been implemented. Do not merge/apply until the retention decision in `docs/DECISION_MEMO_CLIENT_DELETE.md` (ADR-011) is made.
**Goal:** replace the current hard `prisma.client.delete()` (which cascades away the entire clinical and financial record — see the memo) with a soft-delete that preserves every downstream row, while keeping the public API shape (`DELETE /clients/:id`) unchanged for callers.

## 1. Schema migration (additive only)

- Add one nullable column to `Client` in `packages/database/prisma/schema.prisma`:
  ```prisma
  deletedAt DateTime?
  ```
- Add a composite index to support the default "active clients" query efficiently, mirroring the existing `@@index([organizationId, status])` hot-path pattern already on this model:
  ```prisma
  @@index([organizationId, deletedAt])
  ```
- No other model changes. Because the `Client` row is never physically deleted under this plan, none of its `onDelete: Cascade` relations (`Appointment`, `Note`, `TreatmentPlan`, `Diagnosis`, `Medication`, `InsurancePolicy`, `Claim`, `Invoice`, `Payment`, `Admission`, `Assessment`, `WaitlistEntry`) ever fire. This is what keeps the migration surface to a single column.
- Generate the migration the same way `60b9005` / `7db7aec` were generated and verified — `prisma migrate diff --from-schema-datamodel <before> --to-schema-datamodel <after> --script` against the two schema files (no live database needed for that step) — then apply with `prisma migrate deploy` once Postgres is reachable.

## 2. Files likely affected

**Core change:**
- `packages/database/prisma/schema.prisma` — add `deletedAt` + index to `Client`.
- `packages/database/prisma/migrations/<new>/migration.sql` — the additive `ALTER TABLE`.
- `apps/api/src/modules/clients/clients.service.ts`:
  - `remove()` — replace `this.prisma.client.delete(...)` with `this.prisma.client.update({ where: { id }, data: { deletedAt: new Date() } })`.
  - `findAll()` — add `deletedAt: null` to the default `where` clause unless the caller explicitly asked to include deleted records.
  - `findOne()` — decide (see open question below) whether a soft-deleted client 404s by default or remains fetchable by id; implement accordingly.
  - `create()` — no change needed; MRN-uniqueness check (`@@unique([organizationId, mrn])`) already works against the live row regardless of `deletedAt`, though see open question about re-registering a previously-deleted MRN.
- `apps/api/src/modules/clients/clients.controller.ts` — thread an `includeDeleted` flag from the query string to the service, gated to `ORG_ADMIN`/`SUPER_ADMIN` only (front-desk/clinician callers should never see deleted clients by default or on request).
- `apps/api/src/modules/clients/dto/` — add a small `query-clients.dto.ts` (extends the fields `PaginationQueryDto` already provides: `page`, `limit`, `search`) with an added optional `includeDeleted?: boolean`. Keeping this client-specific, rather than adding the field to the shared `common/dto/pagination.dto.ts`, avoids touching every other module that reuses that shared DTO.

**Three other services query `Client` directly, outside `ClientsService` — found by grepping `prisma.client.` across `apps/api/src` rather than assuming only the clients module is affected:**
- `apps/api/src/modules/billing/superbills.service.ts` (line ~28) — `prisma.client.findFirst({ where: { id: clientId, organizationId } })` when generating a superbill. Decide: should a superbill still be generatable for a soft-deleted (e.g., discharged-and-archived) client? Likely yes, for historical billing purposes — so this one probably should *not* filter out `deletedAt`.
- `apps/api/src/modules/notes/notes.service.ts` (line ~489) — `prisma.client.findFirst({ where: { id: dto.clientId, organizationId }, select: { firstName, lastName } })` when AI-drafting a note. This is a forward-looking action (starting new clinical documentation), so it likely *should* exclude soft-deleted clients — drafting a new note against an archived client's chart is probably a mistake the API should prevent.
- `apps/api/src/modules/appointments/appointments.service.ts` (line ~35) — `prisma.client.findUnique({ where: { id: clientId }, select: { phone, firstName } })` for the appointment-confirmation SMS. In practice this only fires right after `AppointmentsService.create()`, which itself would need a similar decision (should new appointments be creatable for a soft-deleted client at all?). If `create()` is blocked for deleted clients, this lookup becomes moot for that path.

None of these three need to change for the migration to be *safe* (they'd keep working exactly as today, since the `Client` row still exists), but each is a real product-behavior decision — call them out explicitly rather than silently leaving them inconsistent with whatever `ClientsService` decides.

**Docs to update once implemented (not part of the code change, but part of closing out the decision record):**
- `docs/DECISIONS.md` — flip ADR-011's `Status:` from `proposed` to `adopted` and summarize the final shape.
- `docs/DATABASE_SCHEMA.md` — reflect the new column if that doc enumerates `Client` fields (confirm at implementation time).

## 3. API behavior

- `DELETE /clients/:id` — same route, same `ORG_ADMIN` role gate, same response shape (`{ success: true }`). Underlying action changes from a row delete to setting `deletedAt`.
- `GET /clients` — excludes soft-deleted clients by default. Add `?includeDeleted=true`, honored only for `ORG_ADMIN`/`SUPER_ADMIN` (enforced in the controller, not just by trusting the query param) — this is the "explicit admin-only escape hatch for compliance/legal lookups" the decision memo called for.
- `GET /clients/:id` — **open question, needs a product decision at implementation time, not assumed here:** either (a) still returns a soft-deleted client to any caller with legitimate access (since e.g. an old appointment's `include: { client }` should keep resolving), or (b) 404s for non-admin callers hitting the client directly by id, matching the "deleted means gone" expectation for a direct lookup even though the row is retained internally. Recommend (a) for internal `include` resolution paths and (b) for the direct `GET /clients/:id` endpoint specifically — i.e. treat "was this fetched directly vs. joined through a child record" as the deciding factor. Needs sign-off before implementation, since it changes observable API behavior.
- **Reactivation:** not in scope for the minimal migration, but a natural follow-up — a `POST /clients/:id/restore` (same role gate) that clears `deletedAt`. Call out as a likely near-term ask once soft-delete ships, not required for the first cut.
- **Real purge (hard delete):** stays out of the public API entirely under this plan. If/when the team defines an actual retention-expiry or right-to-erasure purge process, it should be a separate, deliberately narrow, `SUPER_ADMIN`-only path — not a repurposing of this endpoint.

## 4. Audit-log behavior

- `remove()` still calls `this.audit.record(...)` after the update, same as today's hardened code (`612e15a`). Recommended shape:
  ```ts
  await this.audit.record({
    organizationId,
    actorId,
    action: AuditAction.DELETE,       // keep DELETE — semantically correct from a business/API perspective
    entityType: 'Client',
    entityId: id,
    metadata: { mrn: existing.mrn, softDelete: true },   // distinguishes this from a future real purge
  });
  ```
  Using `AuditAction.DELETE` (rather than `UPDATE`) preserves the existing meaning any audit-log consumer already expects ("this client was deleted"), while `metadata.softDelete: true` makes the distinction from a future real purge explicit and queryable.
- If/when a real purge path is added later, it should use its own clearly-different metadata marker (e.g. `metadata: { softDelete: false, purge: true, reason }`) so the two are never confused when reviewing the trail — this is exactly the distinction the decision memo asked for.
- No change needed to `AuditLog` itself (schema or otherwise) — this is a metadata-only convention.

## 5. Tests required

This codebase currently has unit tests only (`vitest`, no e2e/integration suite), and **`ClientsService` has no existing spec file at all** (`notes.service.spec.ts` and `mfa.service.spec.ts` are the only service specs today) — so this is new coverage, not an extension of existing tests.

- New `apps/api/src/modules/clients/clients.service.spec.ts`:
  - `remove()` calls `prisma.client.update` with `{ deletedAt: expect.any(Date) }`, never `prisma.client.delete`.
  - `remove()` calls `audit.record` with `action: AuditAction.DELETE` and `metadata.softDelete: true`.
  - `findAll()` without `includeDeleted` passes `deletedAt: null` in the Prisma `where`.
  - `findAll({ includeDeleted: true })` omits the `deletedAt` filter.
  - `findOne()` behaves per whatever gets decided in section 3's open question — write the test to lock in that decision once made.
- Controller-level test (or extend an existing guard test) confirming `includeDeleted` is ignored/rejected for non-admin roles, not just hidden in the UI.
- A live-DB regression test (blocked today — no local Postgres reachable in this session, same tracked blocker as everything else needing a live database) to prove empirically that after a soft-delete, a previously-linked `Appointment`, `Claim`, and `Note` are still readable and still resolve their `client` relation. This is the actual proof that the cascade no longer fires; the unit tests above only prove the code *calls* the right Prisma methods, not that the database behaves as expected end-to-end.

## Explicitly out of scope for this plan

- Changing any other model's `onDelete` behavior (notes, documents, diagnoses, medications, etc. — see the separate hard-delete audit for those, reported without implementation per your instruction).
- Building the real purge/right-to-erasure path.
- Any UI/frontend work (this codebase's `apps/web` is out of scope for the backend lane).
