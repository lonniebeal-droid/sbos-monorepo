# Decision Memo: Client Deletion Behavior

**Status:** proposed — awaiting a retention/compliance decision. No code or schema change has been made; this document is analysis only.
**Author:** backend-hardening session, 2026-08-18. Raised as a byproduct of the schema-consistency review that produced `60b9005` / `7db7aec`.
**Scope:** `packages/database/prisma/schema.prisma` (`Client` model and its relations), `apps/api/src/modules/clients/clients.service.ts`.

## Current behavior

`ClientsController.remove()` (role-gated to `ORG_ADMIN`) calls `ClientsService.remove()`, which does a real row delete: `this.prisma.client.delete({ where: { id } })`. There is no soft-delete, archive, or confirmation step — the call is a single, immediate, physical deletion.

Because the `Client` model's child relations are declared `onDelete: Cascade`, Postgres destroys every dependent row in the same transaction. Today that includes:

- **Clinical record:** `Appointment`, `Note` (and, transitively, every `NoteVersion`, `BirpNote`, `DapNote`, `SoapNote` attached to those notes), `TreatmentPlan` (and its `Goal`/`Objective` rows), `Diagnosis`, `Medication`, `Assessment`, `Admission`, `WaitlistEntry`.
- **Financial record:** `InsurancePolicy`, `Claim`, `Invoice` (and its `InvoiceLineItem` rows), `Payment`.

Two relations are the exception — `Document.clientId` and `Task.clientId` are optional with `onDelete: SetNull`, so those rows survive with the client reference cleared rather than being destroyed.

The `AuditLog` table is not foreign-keyed to any of these entities (`entityId` is a plain string), so it survives independently. The client hardening pass earlier this session (`612e15a`) added an audit entry for the `Client` DELETE action itself, with the MRN in the metadata — but that only records that a deletion happened, not the content of what was destroyed. Every audit-log row that references the cascaded claims, invoices, notes, etc. (from earlier CREATE/UPDATE entries) becomes a pointer to a record that no longer exists.

## What's actually destroyed today

In practice: a single `DELETE /clients/:id` call permanently erases a patient's entire chart (every clinical note and its version history, every diagnosis, every treatment plan) and their entire financial history with the practice (every claim, invoice, line item, and payment) in one irreversible transaction. The only recovery path is a full point-in-time database restore — there is no row-level undo.

## Why this is risky

- **Regulatory retention.** Behavioral-health clinical records are subject to state medical-record retention statutes (commonly 7–10+ years, often longer for minors), independent of anything HIPAA itself mandates. Permanently destroying a chart on a UI click has no way to check whether a retention period is still open.
- **Financial/billing recordkeeping.** Claims, invoices, and payments are usually covered by payer-contract retention terms and standard accounting/audit requirements. Hard-deleting billed claims data could conflict with payer agreements even if it's otherwise legal.
- **Litigation/audit holds.** If a client is or becomes involved in a malpractice claim, insurance dispute, or records request, instant permanent deletion removes evidence with no hold mechanism to stop it.
- **Blast radius of a single mistake.** The action is gated to `ORG_ADMIN`, which limits *who* can trigger it, but not the *damage* if they do — there's no second confirmation, no "type the client's name to confirm," no staged/reversible delete. One misclick destroys a full longitudinal patient record.
- **Weakened audit trail.** The delete event itself is logged, but the audit trail for the destroyed child records becomes evidence of things that no longer exist to verify against — reducing its value for exactly the kind of compliance investigation this data is retained for.

## Smallest safe alternative (no schema change required)

If the team wants to reduce risk *before* deciding on a full soft-delete migration, the cheapest lever is purely at the API layer: remove or further restrict the `DELETE /clients/:id` endpoint (e.g., gate it to `SUPER_ADMIN`, or disable it entirely) until a retention policy is set. Zero schema risk, reversible by re-enabling the route, and it stops the irreversible-cascade problem at the source in the meantime.

## Should this become soft-delete instead of hard-delete?

Recommendation: **yes**, but through a dedicated lifecycle field — not by repurposing the existing `Client.status` enum (`PROSPECT / INTAKE / ACTIVE / ON_HOLD / DISCHARGED / INACTIVE`). That enum already carries a distinct, legitimate meaning (where the client is in their care lifecycle); a client can be genuinely `INACTIVE` in care while their record still needs to be fully retained and visible to billing/compliance staff. Conflating "not currently in care" with "record deleted" would break that existing meaning and make `INACTIVE` ambiguous. A separate field keeps the two concerns cleanly independent.

## Minimal safe migration path, if soft-delete is approved

1. **Additive schema change only:** add `deletedAt DateTime?` (nullable) to `Client`. This is a zero-downtime, backward-compatible migration — every existing row defaults to `null` (active), and no other model needs to change, because the `Client` row itself is never physically deleted, so none of today's `onDelete: Cascade` relations ever fire. This keeps the migration surface to one column.
2. **Service change:** `ClientsService.remove()` sets `deletedAt: new Date()` instead of calling `.delete()`.
3. **Default filtering:** `ClientsService.findAll()` / `findOne()` exclude `deletedAt: { not: null }` rows by default, with an explicit admin-only `includeDeleted` escape hatch for compliance/legal lookups.
4. **Keep hard delete, but don't expose it by default:** the Prisma-level capability to physically delete stays available for a narrow, deliberate purge path (e.g., after a defined retention period elapses, or on a verified right-to-erasure request) — gated to `SUPER_ADMIN`, requiring an explicit reason, and logged as its own distinct `AuditAction` so a real purge is never confused with routine deactivation in the trail.
5. **Before wiring up any real purge path:** get the actual retention timeline from legal/compliance — it depends on state medical-record law, payer contract terms, and applicable limitations periods, none of which is an engineering decision.

No code changes were made to implement any of the above — this is the decision memo only, per your instruction.
