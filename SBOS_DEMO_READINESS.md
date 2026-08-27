# SBOS Demo Readiness Report

**Date:** 2026-08-26
**Branch:** `claude/sbos-demo-readiness-docs`
**HEAD:** `74ad3a3` (checkpoint) + 1 commit (acceptance tests + doc)

---

## Quality Gate Summary

| Gate | Status | Details |
|------|--------|---------|
| Lint (tsc --noEmit) | 6/6 PASS | api, web, core, database, tsconfig, + build |
| Unit Tests | 160 PASS | 135 API (29 files) + 25 core (4 files), 0 failures |
| Build | 4/4 PASS | api, web, core, database |

---

## Runtime Acceptance (Local Demo)

All 8 demo flows verified against running API (port 4000) + Postgres (port 54322) + seeded data.

### 1. Auth (Login)
- **Status:** PASS
- Admin (`admin@sbos.health`) login returns access + refresh tokens with user details
- Clinician (`clinician@sbos.health`) login also verified

### 2. Client Demographics (Write Flow)
- **Status:** PASS
- Create client with MRN, name, DOB, contact info
- Edit demographics (name, phone) via PATCH
- Verify persistence via GET (changes survive restart)

### 3. Diagnoses (Add Flow)
- **Status:** PASS
- Add diagnosis with ICD-10 code, description, type, status
- Verify list shows correct count and persisted data

### 4. Medications (Add Flow)
- **Status:** PASS
- Add medication with name, dosage, frequency, route
- Verify list shows correct count and persisted data

### 5. Notes (Compose + Enrichment)
- **Status:** PASS
- Generate draft with `presentingProblem` + `interventions` fields
- Enriched sections: behavior, intervention, response, plan
- Create note with sections, verify status = DRAFT

### 6. Assessments (PHQ-9 / GAD-7)
- **Status:** PASS
- Create PHQ-9 (score=12, Moderate) with response map
- Create GAD-7 (score=8, Mild) with response map
- List returns both, ordered by administeredAt desc

### 7. RBAC
- **Status:** PASS
- ORG_ADMIN can read assessments
- CLINICIAN can read assessments
- CLINICIAN role required for write operations (enforced via `@Roles` decorator)

### 8. CSV Report Export (Data Sources)
- **Status:** PASS
- Analytics overview returns aggregate counts
- Appointments-by-status returns grouped counts
- Claims-by-status returns empty array (no claims in seed data)

---

## New Features (This Branch)

### Backend
- **Assessments CRUD Module** — Controller, service, DTOs (Create/Update), RBAC via `@Roles(Role.CLINICIAN)`, tenant-scoped, audited
- **Note Composer Enrichment** — `presentingProblem` + `interventions` fields on GenerateNoteDto, wired to heuristic note assistant
- **Client Demographics Edit** — `ClientsService.update` with audit trail
- **CSV Export Backend** — Analytics endpoints (overview, appointments-by-status, claims-by-status)

### Frontend
- **EditClientDialog** — Modal form for editing client demographics
- **AddDiagnosisDialog** — Inline form for adding diagnoses to a client
- **AddMedicationDialog** — Inline form for adding medications to a client
- **AddAssessmentDialog** — Instrument selector with interactive PHQ-9/GAD-7 scoring preview
- **Assessments Tab** — Client detail page tab showing assessment history
- **ExportReportsButton** — Downloads timestamped CSV with overview + status breakdowns
- **Note Composer** — Enriched with presentingProblem + interventions fields

### Core Library
- **`@sbos/core/assessments`** — PHQ-9, GAD-7, C-SSRS, AUDIT, DAST-10 instrument definitions, severity bands, `sumResponses`, `scoreAssessment`, `severityForScore`
- **14 core scoring tests** — Boundaries, summation, severity mapping

### Tests Added This Session
- `assessments.service.spec.ts` — 7 tests (CRUD + audit + NotFoundException)
- `clients.service.spec.ts` — 3 new tests for `update` method (field update, dateOfBirth conversion, not-found)

---

## How to Run Locally

```bash
# 1. Start Postgres (Docker)
docker start supabase_db_sbos-health-platform

# 2. Create DB + migrate + seed
docker exec supabase_db_sbos-health-platform psql -U postgres -c "CREATE DATABASE sbos;"
DATABASE_URL="postgresql://postgres:postgres@localhost:54322/sbos" pnpm --filter @sbos/database prisma:migrate
DATABASE_URL="postgresql://postgres:postgres@localhost:54322/sbos" pnpm --filter @sbos/database db:seed

# 3. Start API
DATABASE_URL="postgresql://postgres:postgres@localhost:54322/sbos" pnpm --filter @sbos/api dev

# 4. Start Web (separate terminal)
pnpm --filter @sbos/web dev

# 5. Open http://localhost:3000
# Login: admin@sbos.health / Sbos!2026
```

---

## Commit Trail

| Hash | Message |
|------|---------|
| `c51ab98` | feat: demographics write flows + note composer enrichment |
| `a0d84c4` | feat: assessments module + PHQ-9/GAD-7 scoring + UI |
| `74ad3a3` | chore: tracker update (JU_TRACKER_UPDATE_PENDING.md) |
| (pending) | test: acceptance tests + demo readiness doc |
