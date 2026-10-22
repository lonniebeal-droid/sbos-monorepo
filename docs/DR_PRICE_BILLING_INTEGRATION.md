# Dr. Price — Independent Billing Integration Contract (Synthetic Only)

Status: implementation requirements; NOT authorization to process PHI or redirect payments.

## Two distinct workflows
1. **New patients:** create an independent provider/business billing profile. Capture rendering-provider NPI, legal billing entity/EIN, billing NPI where applicable, service location (host practice), payer enrollment verification, and pay-to/EFT verification. Do not enable real claims until verified.
2. **Existing patients:** identify outstanding receivables and reconcile submitted claims, payments, denials, and adjustments. Mark ownership **pending written assignment** by default. A host-practice agreement to bill future patients does not itself transfer previously billed receivables. Do not rewrite historical billing identities or submit duplicate claims.

## Shared data model
- provider_profile_id, organization_id, rendering_provider_id, billing_entity_id, service_location_id
- patient_reference (synthetic label only in staging), encounter_reference, service_date
- procedure CPT, diagnosis ICD-10, units, per-unit charge, line subtotal, statement total
- receivable_owner_status: pending | under_review | verified
- payer_enrollment_status: pending | under_review | verified
- payment_destination_status: pending | verified
- authorization_reference and audit trail (no secret or bank details in source control)

## Printable document acceptance
- Business/doctor header; dated CPT/ICD-10 itemization, totals and discrepancies flagged for review
- Attorney statement and regular superbill share the same itemization
- Where the original source has a back side: front says CONTINUED ON REVERSE SIDE — SEE OVER; continuation page says OVER (Reverse Side)
- On the FINAL page after the total: **Doctor's Signature: __________  Date: __________**
- Never infer or fabricate missing codes, charges, authorizations or signatures

## Security and integration
- Use ClaimFlow as the billing handoff reference (PR #50).
- Enforce organization/tenant-scoped access, role checks, immutable billing audit history, idempotency and duplicate-claim prevention.
- No production PHI, EFT changes, insurer submissions or patient imports until appropriate security, contractual and payer gates are complete.
- Verify with synthetic test cases for new-patient and transferred-balance workflows.
