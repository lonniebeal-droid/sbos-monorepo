# SBOS — Database Schema

**Engine:** PostgreSQL · **ORM:** Prisma 6 · **Location:**
`packages/database/prisma/schema.prisma`

The schema is normalized and multi-tenant: every tenant-scoped table carries an
`organizationId` foreign key. Money is stored as `Decimal(12,2)`; timestamps are
UTC. All foreign keys are indexed and natural keys are uniquely constrained.

Initial migration: `prisma/migrations/20260724000000_init/migration.sql`
(29 tables, 89 indexes, 63 foreign-key constraints).

## Domains & models (29)

### Tenancy & identity
- **Organization** — tenant root; practice details, NPI, timezone.
- **User** — auth identity; role, status, MFA fields, bcrypt `passwordHash`.
  Unique on `(organizationId, email)`.
- **Clinician** — professional profile 1:1 with a `User`; NPI, license,
  specialties, caseload.
- **Location** — service locations (office/telehealth/community/residential).

### Clients & clinical record
- **Client** — demographics, status, primary clinician, emergency contact.
  Unique on `(organizationId, mrn)`.
- **Admission** — program admission/discharge with level of care.
- **Assessment** — instruments (PHQ-9, GAD-7, C-SSRS) with score + responses.
- **Appointment** — scheduling with type, status, recurrence (self-relation),
  telehealth URL, CPT code.

### Clinical documentation
- **Note** — base clinical note (type, status, author, cosigner, sign dates).
- **BirpNote / DapNote / SoapNote** — 1:1 structured detail tables per format.
- **TreatmentPlan → Goal → Objective** — hierarchical care planning with
  progress tracking.
- **Diagnosis** — ICD-10 code, type, status.
- **Medication** — prescription record linked to a prescribing clinician.

### Insurance, billing & payments
- **InsurancePolicy** — payer, member/group IDs, copay, coverage dates.
- **Claim** — CPT/ICD codes, billed/allowed/paid amounts, status lifecycle.
  Unique on `(organizationId, claimNumber)`.
- **Invoice → InvoiceLineItem** — patient-responsibility billing.
- **Payment** — card/cash/ACH/insurance/adjustment, linked to invoice/claim.

### Collaboration & operations
- **Document** — files with storage key, type, signature state.
- **Task** — assignable work items with priority/status/due date.
- **MessageThread → ThreadParticipant / Message** — secure messaging.
- **Notification** — per-user alerts.
- **AuditLog** — actor/action/entity trail for compliance.

## Key enums (32)

`Role`, `UserStatus`, `Gender`, `ClientStatus`, `LocationType`,
`AppointmentType`, `AppointmentStatus`, `RecurrenceFrequency`, `NoteType`,
`NoteStatus`, `DiagnosisStatus`, `DiagnosisType`, `MedicationStatus`,
`TreatmentPlanStatus`, `GoalStatus`, `InsuranceType`, `ClaimStatus`,
`InvoiceStatus`, `PaymentMethod`, `PaymentStatus`, `DocumentType`,
`TaskStatus`, `TaskPriority`, `MessageThreadType`, `NotificationType`,
`AdmissionStatus`, `AuditAction`, …

## Referential integrity

- Tenant deletes cascade to child records (`onDelete: Cascade`).
- Optional references use `onDelete: SetNull` (e.g. a client's primary
  clinician, an appointment's location).
- Specialized note tables cascade from their parent `Note`.

## Working with the schema

```bash
pnpm --filter @sbos/database prisma:generate   # regenerate client
pnpm --filter @sbos/database prisma:migrate     # create/apply dev migration
pnpm --filter @sbos/database prisma:deploy       # apply migrations (prod)
pnpm --filter @sbos/database db:seed             # seed development data
```

A running PostgreSQL instance and `DATABASE_URL` are required for migrate/seed;
`generate` and `validate` do not need a database connection.
