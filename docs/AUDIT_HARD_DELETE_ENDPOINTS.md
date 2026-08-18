# Audit: Hard-Delete Endpoints Across sbos-monorepo

**Status:** report only — no code changes made. Per instruction: fix only if a finding is as obviously low-risk/mechanical as the tenant-scope FK gaps (`60b9005`/`7db7aec`); otherwise report and stop.
**Method:** grepped every controller for `@Delete(`, read each corresponding `*.service.ts` `remove()`/`cancel()` implementation, and cross-checked `packages/database/prisma/schema.prisma` for what (if anything) is declared `onDelete: Cascade` beneath each deleted model — not inferred, confirmed by reading the actual relation declarations.

## Summary table

| Endpoint | Role gate | Underlying action | Cascade impact (from schema) | Audit-logged? |
|---|---|---|---|---|
| `DELETE /clients/:id` | `ORG_ADMIN` | hard delete | **Destroys entire clinical + financial record** — already covered by `docs/DECISION_MEMO_CLIENT_DELETE.md` (ADR-011) and `docs/PLAN_CLIENT_SOFT_DELETE.md` | Yes (`612e15a`) |
| `DELETE /treatment-plans/:id` | `SUPERVISOR` | hard delete | Cascades to `Goal` → `Objective` (two levels, both `onDelete: Cascade`) — an entire care plan's goal/objective tree is destroyed with the parent | **No** |
| `DELETE /documents/:id` | `ORG_ADMIN` | hard delete | No DB cascade children, but the service **also deletes the underlying storage object** (`this.storage.remove(document.storageKey)`) before the DB row — this is permanent, unrecoverable removal of the actual file (which may be a signed consent form or uploaded clinical/insurance document, not just its DB record) | Yes |
| `DELETE /notes/:id` | `CLINICIAN` | hard delete | Cascades to `NoteVersion`, `BirpNote`, `DapNote`, `SoapNote` — **but the service itself blocks deletion unless `note.status === DRAFT`** (`ForbiddenException` otherwise), so signed/finalized clinical notes cannot be hard-deleted through this endpoint. Built-in guard already limits blast radius. | Yes |
| `DELETE /appointments/:id` | `ORG_ADMIN` | hard delete | `Note.appointmentId` and `Claim.appointmentId` are both `onDelete: SetNull` — deleting an appointment does **not** destroy notes or claims, only clears their appointment reference (a billing/claims record loses its appointment link, but the claim itself survives) | Yes |
| `DELETE /locations/:id` | `ORG_ADMIN` | hard delete | `Appointment.locationId` is `onDelete: SetNull` — no cascade destruction; only loses the location label on past appointments | **No** |
| `DELETE /medications/:id` | `CLINICIAN` | hard delete | No child relations found (`medicationId` referenced nowhere else in schema) — leaf record | **No** |
| `DELETE /diagnoses/:id` | `CLINICIAN` | hard delete | No child relations found (`diagnosisId` referenced nowhere else) — leaf record | **No** |
| `DELETE /tasks/:id` | `SUPERVISOR` (fixed this session, `a47d0bd`) | hard delete | No child relations found — leaf record | No (pre-existing; out of scope here) |
| `DELETE /scheduling/availability/:id` | `ORG_ADMIN` | hard delete | No child relations found — leaf record | No |
| `DELETE /scheduling/waitlist/:id` | `FRONT_DESK` | hard delete | No child relations found — leaf record | No |
| `DELETE /jessie/knowledge/:id` | `ORG_ADMIN` | hard delete | No child relations found — leaf record (internal KB article, not clinical/PHI data) | No |

**Confirmed safe by omission — no delete endpoint exists at all:** `billing.controller.ts` (claims/invoices/payments/payers/service-codes can only be status-updated, never deleted via the API), `messaging.controller.ts`, `organizations.controller.ts`, `users.controller.ts`. Grepped `@Delete(` across every `*.controller.ts` in `apps/api/src/modules` to confirm this list is exhaustive — 12 delete routes total, all listed above.

## Findings, ranked

1. **`TreatmentPlan` delete cascades two levels deep into clinical care-plan data (`Goal` → `Objective`)** — the same *category* of risk as the `Client` cascade (irreversible destruction of clinical content), just smaller blast radius (one plan's goals/objectives, not a client's entire chart). This is a real product/compliance question — same as the Client finding — not a mechanical fix. **Not fixed. Recommend the same treatment as Client:** a short decision on whether treatment plans should soft-delete/archive instead, once the Client soft-delete decision is resolved (they'd likely share the same pattern).

2. **`Document` hard-delete also deletes the underlying stored file, not just the DB row.** If any documents are consent forms, signed records, or compliance-relevant uploads, this is a permanent, unrecoverable loss with no schema/DB trace at all (worse than a DB cascade, since there's no `onDelete` audit trail to even diff against). This is a product/retention decision, not a mechanical fix. **Not fixed. Flagging for the same retention conversation as Client/TreatmentPlan.**

3. **Five delete endpoints have no audit logging at all:** `diagnoses`, `medications`, `locations`, `treatment-plans`, and both `scheduling` deletes (`availability`, `waitlist`) call `prisma.*.delete()` directly with no `this.audit.record(...)` call afterward — unlike `clients`, `appointments`, `notes`, `documents`, and `tasks`(create/update, not delete) which do. This is the *same mechanical pattern* already applied five times this session (`ac93312`, `e4da0c5`, `8aed110`, plus the pre-existing `payments.service.ts`), so it likely qualifies as "as clear and low-risk as the waitlist FK fix" — **but it's outside this task's explicit scope** (audit hard-delete *cascade risk*, not audit-*logging* coverage), so it is reported here rather than fixed. Recommend as the next audit-logging follow-up if you want it picked up.

4. **No new tenant-scope FK gaps, missing-constraint, or schema-vs-service-assumption issues found** among the models touched by these 12 endpoints — the earlier FK sweep (`60b9005`/`7db7aec`) already covered the only two gaps that existed anywhere in the schema.

## What was explicitly not done

- No code, schema, or migration changes in this task — report only, per instruction.
- Did not re-open the `Client` cascade question (already fully covered by ADR-011 + the decision memo + the soft-delete plan).
- Did not fix the missing audit-logging on the five delete endpoints listed in finding 3, despite it matching the established low-risk pattern — flagged instead, since it's a different category of finding than "hard-delete destroys clinical/billing data" and the instruction scoped this pass to the latter.
