PROJECT: SBOS
AGENT: SBOS Build Agent (mimo-v2.5-free)
MODEL: opencode/mimo-v2.5-free
STARTING HEAD: 25dd7f5
ENDING HEAD: a0d84c4
BRANCH: claude/sbos-demo-readiness-docs

FILES CHANGED (23 files, +1612 / -6):

  apps/api/src/ai/heuristic-note-assistant.spec.ts          (new)
  apps/api/src/app.module.ts                                (modified)
  apps/api/src/modules/assessments/assessments.controller.ts (new)
  apps/api/src/modules/assessments/assessments.module.ts    (new)
  apps/api/src/modules/assessments/assessments.service.ts   (new)
  apps/api/src/modules/assessments/dto/create-assessment.dto.ts (new)
  apps/api/src/modules/assessments/dto/update-assessment.dto.ts (new)
  apps/api/src/modules/notes/dto/generate-note.dto.spec.ts  (new)
  apps/api/src/modules/notes/dto/generate-note.dto.ts       (modified)
  apps/api/src/modules/notes/notes.service.spec.ts          (modified)
  apps/api/src/modules/notes/notes.service.ts               (modified)
  apps/web/src/app/(app)/clients/[id]/page.tsx              (modified)
  apps/web/src/app/(app)/reports/page.tsx                   (modified)
  apps/web/src/components/clients/add-assessment-dialog.tsx (new)
  apps/web/src/components/clients/add-diagnosis-dialog.tsx  (new)
  apps/web/src/components/clients/add-medication-dialog.tsx (new)
  apps/web/src/components/clients/edit-client-dialog.tsx    (new)
  apps/web/src/components/notes/note-composer.tsx           (modified)
  apps/web/src/components/reports/export-reports-button.tsx (new)
  apps/web/src/lib/actions.ts                               (modified)
  packages/core/src/assessments.test.ts                     (new)
  packages/core/src/assessments.ts                          (new)
  packages/core/src/index.ts                                (modified)

FEATURES/FIXES:

1. CLIENT DETAIL WRITE FLOWS
   - EditClientDialog: edit demographics (name, DOB, email, phone, status)
   - AddDiagnosisDialog: inline ICD-10 diagnosis with type/status
   - AddMedicationDialog: inline medication with dosage/frequency/route
   - Server actions: updateClientAction, deleteClientAction, addDiagnosisAction, addMedicationAction
   - Client detail page wired with edit button and inline add forms on Diagnoses/Medications tabs

2. NOTE COMPOSER ENHANCEMENT
   - Extended GenerateNoteDto with presentingProblem and interventions fields
   - Updated NoteComposer UI with presenting problem and interventions inputs
   - Jessie AI generation now receives richer clinical context

3. CSV REPORT EXPORT
   - ExportReportsButton component: fetches overview + appointments-by-status + claims-by-status
   - Downloads timestamped CSV with practice KPIs, appointment breakdown, and claims data
   - Replaced placeholder Export button on Reports page

4. ASSESSMENTS MODULE (PHQ-9/GAD-7/C-SSRS/AUDIT/DAST-10)
   - Full CRUD API with RBAC (CLINICIAN write, all auth read), tenant-scoped, audited
   - @sbos/core scoring: instrument definitions, severity bands, response summation
   - 14 new core tests for assessment scoring logic
   - AddAssessmentDialog with interactive per-question scoring and live score preview
   - Assessments tab on client detail page with stat card and history list

5. ADDITIONAL TESTS
   - heuristic-note-assistant.spec.ts: 2 tests for offline note generation
   - generate-note.dto.spec.ts: 2 tests for DTO validation (trim, whitespace rejection)

LINT RESULT: PASS (6/6 packages)
TEST RESULT: PASS (25 core + 125 API = 150 total, 0 failures)
BUILD RESULT: PASS (4/4 packages build; Next.js standalone trace collection slow on this machine but typecheck clean)
SECURITY VERIFICATION:
  - All new API endpoints use existing JWT + RBAC guards (CLINICIAN gate on writes)
  - Tenant isolation maintained via organizationId scoping on all queries
  - No credentials exposed, no security weakened
  - Assessment responses stored as JSON (Prisma InputJsonValue), no injection risk

CURRENT STATUS: Two meaningful feature commits landed. All gates green.
BLOCKERS: None (local build verified).
NEXT ACTION: Continue building toward production-ready LOCAL milestone. Next priorities:
  - Admissions module (schema exists, no API/UI yet)
  - Calendar drag-to-reschedule (complex client-side state)
  - Client portal (needs infra)
