# Retention Implementation Package: Client, TreatmentPlan, Document

**Status:** planning only — nothing in this document has been implemented, and no code/schema files were touched to produce it. This package consolidates and finalizes the three retention findings from `docs/DECISION_MEMO_CLIENT_DELETE.md` (ADR-011) and `docs/AUDIT_HARD_DELETE_ENDPOINTS.md` (ADR-012) into one implementation-ready reference, so that once you approve a direction, the actual coding pass (by Codex or otherwise) has an unambiguous spec to work from.

**How this was produced:** every file path, field name, and behavior described below was read directly from the current state of `/Users/lonniebgroupllc/sbos-monorepo` on your Mac via this session's repo access — not recalled from memory or inferred. Where I'm not 100% certain of a downstream behavior (e.g. production storage), I say so explicitly rather than guessing.

---

## 1. Client soft-delete — final plan

This finalizes `docs/PLAN_CLIENT_SOFT_DELETE.md` (committed `35e923a`), which is still accurate. Two things it left open are resolved here so this is implementation-ready:

- **`GET /clients/:id` for a soft-deleted client:** finalized as **(a)** — a soft-deleted client remains resolvable through internal `include` paths (e.g. an old `Appointment.client`) for any caller with legitimate access to that parent record, but the **direct** `GET /clients/:id` endpoint 404s for non-admin callers and only succeeds for `ORG_ADMIN`/`SUPER_ADMIN` (mirroring the `includeDeleted` gate already planned for `GET /clients`).
- **MRN uniqueness against soft-deleted rows:** stays as-is for v1 — the existing `@@unique([organizationId, mrn])` continues to apply even to soft-deleted rows, so an MRN cannot be reused until the underlying row is actually purged. Relaxing this (e.g. a Postgres partial unique index that only enforces uniqueness where `deletedAt IS NULL`) is a real but separate schema change, deliberately excluded from v1 to keep the migration purely additive. Flagged as a v2 candidate if MRN reuse after archival turns out to matter operationally.
- **Reactivation (`POST /clients/:id/restore`)** and **real purge**: confirmed out of scope for v1, as already stated in the plan.

Everything else in `PLAN_CLIENT_SOFT_DELETE.md` — the `deletedAt DateTime?` column, the composite index, `remove()`/`findAll()`/`findOne()` changes, the new `query-clients.dto.ts`, and the audit-log metadata shape — stands as written and is treated as final.

---

## 2. TreatmentPlan delete/cascade — decision options

`TreatmentPlan.remove()` today (`treatment-plans.service.ts`) hard-deletes, cascading to `Goal` (`onDelete: Cascade`) which cascades to `Objective` (`onDelete: Cascade`) — confirmed directly from `schema.prisma` lines 905–945. Unlike Client, `TreatmentPlan` and `Goal`/`Objective` are **not** queried anywhere outside `treatment-plans.service.ts` (grepped `prisma.treatmentPlan.` across `apps/api/src` — zero external call sites), so this is a smaller, more self-contained change than Client. Three options, not a single recommendation, since you haven't chosen a direction for this one yet:

**Option A — Soft-delete, same pattern as Client.** Add `deletedAt DateTime?` to `TreatmentPlan`, `remove()` sets it instead of deleting, `findForClient()`/`findOne()` filter it by default. Goals/Objectives are never touched since the parent row is never physically deleted. Most consistent with the Client decision; recommended if you want one uniform retention model across the platform.

**Option B — Restrict the delete endpoint, lean on the existing status lifecycle.** `TreatmentPlanStatus` already has `DRAFT / ACTIVE / UNDER_REVIEW / COMPLETED / DISCONTINUED` (confirmed in `schema.prisma`), and `update()` already sets `endDate` on `COMPLETED`/`DISCONTINUED`. A plan that's no longer active can already be represented without deleting anything. Under this option, `DELETE /treatment-plans/:id` is removed or restricted to `SUPER_ADMIN`, and the existing status transition becomes the normal way to retire a plan. Zero schema change — this is the "smallest safe alternative" pattern from the Client memo, applied here.

**Option C — Keep hard delete, but add a same-codebase guard.** `notes.service.ts` already blocks deleting a `Note` unless `status === DRAFT` (confirmed — `ForbiddenException('Only draft notes can be deleted')`). Option C mirrors that exact pattern on `TreatmentPlan.remove()`: block the delete unless `status === DRAFT` (i.e., a plan that was never activated). This is a one-line service change, no schema/migration, and reuses an idiom already established in this codebase — but it does not address a `DRAFT` plan that already has goals/objectives attached, since those would still cascade-delete.

**My read, not a decision:** Option C is the cheapest near-term mitigation if you want something before committing to a full retention model (it's genuinely comparable in size to the earlier FK/audit-logging fixes). Option A is the right long-term answer for consistency with Client. Option B is worth considering only if the team is comfortable treating "discontinued" as the practical end-state for a plan and never actually removing the record from the list views.

---

## 3. Document delete/file-retention — decision options, with a correction to the earlier audit

**Correction to `docs/AUDIT_HARD_DELETE_ENDPOINTS.md` finding 2:** that report described the Document delete as "permanent, unrecoverable removal of the actual file." Re-reading `apps/api/src/storage/local-storage.provider.ts` just now, the currently-bound `STORAGE_PROVIDER` (`LocalStorageProvider`) implements `remove()` as an explicit no-op:
```ts
async remove(): Promise<void> {
  // Local provider is metadata-only; object lifecycle is a no-op here.
}
```
So **today, in this repo, deleting a document does not actually destroy any file bytes** — there is no real object-storage backend wired up yet at all (`storage.module.ts` binds only `LocalStorageProvider`; no S3 or other production provider exists in the codebase). The original finding is accurate as a description of what the `StorageProvider` interface is *designed* to do once a real provider is bound, and remains a real risk to plan for now, before that provider exists — but it overstated the *current* behavior, which is DB-row-only. Flagging this correction directly rather than letting a slightly wrong finding stand uncorrected in the decision record.

That said, the DB-row loss is still real today, and the destructive-file-removal risk is real for whenever a production storage provider gets added — so it's still worth deciding now, before that provider exists, rather than after.

**Option A — Soft-delete the DB row, and stop calling `storage.remove()` from the delete path entirely.** Add `deletedAt DateTime?` to `Document`, `remove()` sets it instead of deleting, `findForClient()` filters it by default. Drop the `this.storage.remove(document.storageKey)` call from `remove()` (or gate it behind a future purge path) so that whenever a real storage provider is bound later, it can't silently become destructive without a separate decision. Lowest overall risk; recommended.

**Option B — Keep hard-delete of the DB row, but explicitly decouple storage removal now.** Same `storage.remove()` change as Option A, but no schema change — the DB row still physically deletes. Smaller change than Option A, but doesn't address the "permanently loses the chart's document list entry" concern the same way.

**Option C — Full soft-delete of both the DB row and the storage object.** Requires `StorageProvider` to grow a real soft-delete/restore capability (e.g., S3 versioning + lifecycle rules, or a `softRemove`/`restore` pair on the interface), which does not exist today. Correct long-term answer once a production storage provider is actually chosen, but out of scope until that decision is made — implementing it against `LocalStorageProvider` would be building against an interface no real backend uses yet.

**My read, not a decision:** Option A is the only one that's actually implementable against the codebase as it exists today without also having to design a storage-provider capability that doesn't exist. Recommend deciding the storage-provider question (S3 vs. something else, and when) as a related-but-separate decision — this package doesn't include a recommendation on that, since it's an infrastructure choice outside retention policy.

---

## 4. Recommended safest path for healthcare/PHI (across all three)

- **One consistent retention primitive:** a dedicated `deletedAt DateTime?` field per model, never a repurposed status/lifecycle enum — already the Client decision (ADR-011); recommend applying the same shape to `TreatmentPlan` and `Document` if/when you approve Option A for each, so the platform has one retention pattern instead of three different ones an engineer has to remember.
- **Real physical delete never exposed on the public API** for any of the three. If a genuine purge capability is ever needed (retention-expiry, right-to-erasure), it should be one narrow, `SUPER_ADMIN`-gated, reason-required path with its own distinct `AuditAction` metadata marker — not a repurposing of these endpoints. This was the Client memo's recommendation; it applies identically here.
- **Sequencing:** Client first (already fully planned and ready to implement on your go-ahead), then TreatmentPlan (self-contained, no external call sites, can ship independently), then Document last — specifically because Document's file-retention half of the decision is entangled with a storage-provider choice that hasn't been made yet, and forcing that decision now would be scope creep beyond "retention."
- **Audit logging:** for every model, keep `AuditAction.DELETE` (not `UPDATE`) for the soft-delete action, with `metadata.softDelete: true`, exactly as decided for Client — this keeps the audit trail's existing semantics ("this record was deleted") intact while making the soft/hard distinction queryable, and requires no `AuditLog` schema change for any of the three.

---

## 5. Exact code files likely affected

### Client (final — already detailed in `docs/PLAN_CLIENT_SOFT_DELETE.md`; restated here for completeness)
- `packages/database/prisma/schema.prisma` — `deletedAt` + `@@index([organizationId, deletedAt])` on `Client`.
- `packages/database/prisma/migrations/<new>/migration.sql` — additive `ALTER TABLE`.
- `apps/api/src/modules/clients/clients.service.ts` — `remove()`, `findAll()`, `findOne()`.
- `apps/api/src/modules/clients/clients.controller.ts` — thread `includeDeleted`.
- `apps/api/src/modules/clients/dto/query-clients.dto.ts` — new file.
- Touch-points needing a product decision, not a forced change: `apps/api/src/modules/billing/superbills.service.ts` (~line 28), `apps/api/src/modules/notes/notes.service.ts` (~line 489), `apps/api/src/modules/appointments/appointments.service.ts` (~line 35).
- `docs/DECISIONS.md` — flip ADR-011 `Status:` to `adopted`.

### TreatmentPlan (if Option A is chosen)
- `packages/database/prisma/schema.prisma` — `deletedAt DateTime?` + `@@index([organizationId, deletedAt])` on `TreatmentPlan` (mirrors the existing `@@index([organizationId])`/`@@index([clientId])` already on the model).
- `packages/database/prisma/migrations/<new>/migration.sql` — additive `ALTER TABLE`.
- `apps/api/src/modules/treatment-plans/treatment-plans.service.ts` — `remove()` (set `deletedAt` instead of delete), `findForClient()` (default-exclude), `findOne()` (same open-question pattern as Client's direct-fetch case).
- `apps/api/src/modules/treatment-plans/treatment-plans.controller.ts` — only if an `includeDeleted` escape hatch is wanted; not strictly required since this list is already scoped `?clientId=` and clinician-facing rather than admin-facing.
- No new DTO required unless `includeDeleted` is added to the existing query surface — `findForClient` only takes a bare `clientId` string today, not a DTO object.
- No external touch-points to reconcile (confirmed zero other call sites via grep).
- `docs/DECISIONS.md` — new ADR entry recording the chosen option.

### Document (if Option A is chosen)
- `packages/database/prisma/schema.prisma` — `deletedAt DateTime?` + `@@index([organizationId, deletedAt])` on `Document`.
- `packages/database/prisma/migrations/<new>/migration.sql` — additive `ALTER TABLE`.
- `apps/api/src/modules/documents/documents.service.ts` — `remove()` (set `deletedAt`, drop the `this.storage.remove(...)` call), `findForClient()` (default-exclude), `ensure()`/`getWithDownloadUrl()` (decide whether a soft-deleted document's download URL should still resolve — likely yes for admin/compliance access, same pattern as Client's direct-fetch question).
- `apps/api/src/modules/documents/documents.controller.ts` — only if an `includeDeleted` escape hatch is wanted.
- `apps/api/src/storage/storage.interface.ts` — no change required for Option A (the interface's `remove()` method just stops being called from the delete path; the method itself can stay for a future real purge path).
- No external touch-points to reconcile (confirmed zero other call sites via grep).
- `docs/DECISIONS.md` — new ADR entry recording the chosen option.

---

## 6. Exact migrations likely needed

Same generation technique used for every schema change this session (`prisma migrate diff --from-schema-datamodel <before>.prisma --to-schema-datamodel <after>.prisma --script`, confirmed working without a live database connection, matching ADR-009's precedent) — no live Postgres required to generate or verify these.

1. **Client:** `packages/database/prisma/migrations/<timestamp>_client_soft_delete/migration.sql` — expected to be exactly:
   ```sql
   ALTER TABLE "Client" ADD COLUMN "deletedAt" TIMESTAMP(3);
   CREATE INDEX "Client_organizationId_deletedAt_idx" ON "Client"("organizationId", "deletedAt");
   ```
2. **TreatmentPlan** (if approved): `packages/database/prisma/migrations/<timestamp>_treatment_plan_soft_delete/migration.sql` — same shape, `"TreatmentPlan"` in place of `"Client"`.
3. **Document** (if approved): `packages/database/prisma/migrations/<timestamp>_document_soft_delete/migration.sql` — same shape, `"Document"` in place of `"Client"`.

All three are additive-only (`ADD COLUMN` nullable + `CREATE INDEX`), zero-downtime, and independently applicable — they don't need to ship together. None of them have been generated yet; this section describes what each would contain, not a completed artifact. Whichever ship, still need `prisma migrate deploy` run once Postgres is reachable — same standing blocker as `60b9005`/`7db7aec`, unresolved in this session.

---

## 7. Exact tests needed

Mirrors the pattern from `docs/PLAN_CLIENT_SOFT_DELETE.md` section 5 and the mock style already used in this session's audit-logging commit (`2ac33cb`) — `PrismaService`/`AuditService` mocked directly with `vi.fn()`, no Nest `TestingModule` bootstrap, matching `notes.service.spec.ts`'s existing convention.

**Client** — new `apps/api/src/modules/clients/clients.service.spec.ts` (none exists today):
- `remove()` calls `prisma.client.update({ data: { deletedAt: expect.any(Date) } })`, never `.delete`.
- `remove()` calls `audit.record` with `action: AuditAction.DELETE`, `metadata.softDelete: true`.
- `findAll()` without `includeDeleted` passes `deletedAt: null` in the `where`.
- `findAll({ includeDeleted: true })` omits the `deletedAt` filter.
- `findOne()` behavior per whatever gets decided for the direct-fetch open question (locked in above as "404 for non-admin").
- Controller-level test confirming `includeDeleted` is rejected/ignored for non-admin roles server-side, not just hidden client-side.

**TreatmentPlan** (if Option A) — extend the just-added `treatment-plans.service.spec.ts` (created this session, `2ac33cb`, currently only covers `remove()`'s existing hard-delete + audit behavior):
- Update the existing `remove()` test to assert `prisma.treatmentPlan.update({ data: { deletedAt: expect.any(Date) } })` instead of `.delete`.
- New test: `findForClient()` default-excludes `deletedAt`-set rows.
- New test: an `includeDeleted`-equivalent path (if added) includes them.

**Document** (if Option A) — new `apps/api/src/modules/documents/documents.service.spec.ts` (none exists today):
- `remove()` calls `prisma.document.update({ data: { deletedAt: expect.any(Date) } })`, never `.delete`.
- `remove()` does **not** call `storage.remove(...)` (this is the behavioral change from today — worth a test precisely because it's easy to regress).
- `remove()` still calls `audit.record` with `action: AuditAction.DELETE`, `metadata.softDelete: true`.
- `findForClient()` default-excludes soft-deleted documents.

**Cross-cutting, all three:** a live-DB regression test proving that after a soft-delete, previously-linked child records (e.g. `Client` → `Appointment`/`Claim`/`Note`; `TreatmentPlan` → `Goal`/`Objective`) are still readable and resolve their parent relation. Blocked today by the same no-reachable-Postgres constraint tracked since `60b9005` — cannot run until Postgres is reachable, regardless of which options are approved.

---

## 8. Rollback plan

All three migrations are additive-only, which makes rollback low-risk by construction:

- **Schema rollback:** `ALTER TABLE "<Model>" DROP COLUMN "deletedAt";` and `DROP INDEX "<Model>_organizationId_deletedAt_idx";` cleanly reverses each migration with zero data loss, since the column was never load-bearing for anything else. This is safe to run even after real usage, because no other column or relation ever depends on `deletedAt`.
- **Code rollback:** each service change is a self-contained diff (swap `.delete()` back for `.update({ deletedAt })`, remove the default `deletedAt: null` filter) — a straight `git revert` of the implementation commit cleanly restores hard-delete behavior, since nothing else in the codebase reads `deletedAt` outside the one service per model (confirmed via the same grep used in section 5).
- **Data-safety note specific to rollback:** if any soft-deletes actually happened before a rollback, reverting to hard-delete does **not** retroactively delete those "soft-deleted" rows — they simply become visible again as if never deleted (since `deletedAt` is dropped and the default filter is gone). That's the correct behavior for this kind of rollback (fail toward more data visible, not toward destroying more data) and should be called out to whoever reviews the revert.
- **Migration-apply rollback (if already deployed to a live database):** since none of these migrations touch existing data or existing columns, `prisma migrate resolve --rolled-back <migration_name>` followed by removing the migration directory is the standard Prisma path — no custom down-migration needed because the forward migration itself is trivially reversible.
- **No rollback path is needed for a decision not to implement Option A** for TreatmentPlan or Document — those are independent go/no-go decisions; declining either has zero effect on Client or on each other.

---

## 9. Prompt Codex should run once you approve

Do not send this until you've told me which options you're approving (Client is already decided; TreatmentPlan and Document each need an A/B/C choice from you first). This is written to hand to Codex (or run in this session) only after that approval, one model at a time or all together depending on what you approve:

```
Implement soft-delete for <Client | TreatmentPlan | Document> in sbos-monorepo,
per docs/RETENTION_IMPLEMENTATION_PACKAGE.md section 5 (files affected),
section 6 (migration shape), and section 7 (tests required). Scope:

1. Add `deletedAt DateTime?` and the matching `@@index([organizationId, deletedAt])`
   to the <Model> model in packages/database/prisma/schema.prisma. Generate the
   migration via `prisma migrate diff --from-schema-datamodel <before>.prisma
   --to-schema-datamodel <after>.prisma --script` (no live database required) and
   verify with `prisma validate`.
2. Update <Model>Service.remove() to set `deletedAt: new Date()` via
   `prisma.<model>.update(...)` instead of `prisma.<model>.delete(...)`.
   [Document only: also remove the `this.storage.remove(document.storageKey)`
   call from remove().]
3. Update the default list/find query (`findAll`/`findForClient`/`findOne` as
   applicable) to filter `deletedAt: null` by default.
   [Client only: add the `includeDeleted` query param, admin-gated server-side,
   per the finalized plan in section 1.]
4. Keep the existing `audit.record(...)` call in remove(), changing only the
   metadata to add `softDelete: true`. Do not change the AuditAction from DELETE.
5. Add/extend the spec file exactly as scoped in section 7 of the retention
   package.
6. Verify with the same discipline used for every prior change this session:
   pnpm --filter @sbos/api build, pnpm --filter @sbos/api lint (tsc --noEmit),
   pnpm --filter @sbos/api test (vitest run), and a live boot smoke test
   (NODE_ENV=development with dummy JWT/AUTH secrets, no live Postgres needed —
   confirm the relevant module initializes cleanly and its routes still map).
7. One commit. Do not touch any other model, do not add a real purge/hard-delete
   path, do not change any other endpoint's behavior, do not push to remote
   unless explicitly told to. Report: files changed, commit hash, exact
   verification output, and anything you had to deviate from this spec on.
```

---

## What this package does not do

- Does not implement any code or schema change.
- Does not choose Option A/B/C for TreatmentPlan or Document on your behalf — those are presented as options, not decisions, per your instruction.
- Does not touch Lovable or any Lovable-adjacent work.
- Does not assume repo state beyond what this session actually read from `/Users/lonniebgroupllc/sbos-monorepo` moments before writing each section.
