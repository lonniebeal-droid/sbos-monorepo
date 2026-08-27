PROJECT: SBOS
AGENT: SBOS Build Agent (mimo-v2.5-free)
MODEL: opencode/mimo-v2.5-free
STARTING HEAD: 25dd7f5
ENDING HEAD: a871644
BRANCH: claude/sbos-demo-readiness-docs

COMMITS:
  c51ab98 feat: demographics write flows + note composer enrichment
  a0d84c4 feat(assessments): add assessments API module, PHQ-9/GAD-7 scoring, and client chart UI
  74ad3a3 docs: add tracker update for SBOS build session
  a871644 SBOS: verify end-to-end demo readiness

FILES CHANGED (26 files, +1956 / -6):

  apps/api/src/ai/heuristic-note-assistant.spec.ts          (new)
  apps/api/src/app.module.ts                                (modified)
  apps/api/src/modules/assessments/assessments.controller.ts (new)
  apps/api/src/modules/assessments/assessments.module.ts    (new)
  apps/api/src/modules/assessments/assessments.service.ts   (new)
  apps/api/src/modules/assessments/assessments.service.spec.ts (new)
  apps/api/src/modules/assessments/dto/create-assessment.dto.ts (new)
  apps/api/src/modules/assessments/dto/update-assessment.dto.ts (new)
  apps/api/src/modules/clients/clients.service.spec.ts      (modified)
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
  SBOS_DEMO_READINESS.md                                    (new)

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

5. DEMO ACCEPTANCE TESTS
   - assessments.service.spec.ts: 7 tests (CRUD, audit, NotFoundException)
   - clients.service.spec.ts: 3 new tests for update (field update, dateOfBirth conversion, not-found)

LINT RESULT: PASS (6/6 packages)
TEST RESULT: PASS (25 core + 135 API = 160 total, 0 failures)
BUILD RESULT: PASS (4/4 packages build)
SECURITY VERIFICATION:
  - All new API endpoints use existing JWT + RBAC guards (CLINICIAN gate on writes)
  - Tenant isolation maintained via organizationId scoping on all queries
  - No credentials exposed, no security weakened
  - Assessment responses stored as JSON (Prisma InputJsonValue), no injection risk

RUNTIME ACCEPTANCE (local API + Postgres):
  AUTH: PASS (login returns tokens + user)
  CLIENTS: PASS (create, edit demographics, persist)
  DIAGNOSES: PASS (add ICD-10, list, persist)
  MEDICATIONS: PASS (add medication, list, persist)
  NOTES: PASS (generate draft with enrichment, create, persist)
  ASSESSMENTS: PASS (PHQ-9 score=12, GAD-7 score=8, list, persist)
  RBAC: PASS (admin + clinician read, clinician write guard)
  CSV: PASS (overview, appointments-by-status, claims-by-status)

CURRENT STATUS: Demo-readiness milestone verified and committed. All gates green.
BLOCKERS: None (local build + runtime verified).
NEXT ACTION: Continue building toward production-ready LOCAL milestone. Next priorities:
  - Admissions module (schema exists, no API/UI yet)
  - Calendar drag-to-reschedule (complex client-side state)
  - Client portal (needs infra)
