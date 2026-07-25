# SBOS — Roadmap

Phased delivery plan. Phases 1–4 (foundation) are complete; the remaining
phases build production capability on top.

## ✅ Phase 1 — Web foundation
Next.js 15 app, Tailwind + shadcn/ui, JWT auth + middleware, dashboard shell,
dark mode. **Done.**

## ✅ Phase 2 — API foundation
NestJS REST API, Swagger, JWT (access+refresh), RBAC, validation, rate limiting.
**Done.**

## ✅ Phase 3 — Database
Prisma + PostgreSQL schema (29 models), production migration, seed. **Done.**

## ✅ Phase 4 — Dashboard modules
Schedule, Calendar, Clients, Clinical Notes (with BIRP/DAP/SOAP composer),
Billing, Reports, Settings. **Done.**

## 🔜 Phase 5 — Auth & tenancy hardening
- Wire web auth to the API (replace dev credential store).
- Organization & Location CRUD endpoints + UI.
- MFA (TOTP) using existing schema fields.
- Refresh-token rotation + revocation.

## Phase 6 — Client & clinician management
- Clients API (CRUD, search, filters) backed by Prisma.
- Client chart / detail view; admissions & assessments.
- Clinician profiles, caseload, availability.

## Phase 7 — Scheduling engine
- Appointments API; recurring generation; conflict detection.
- Calendar interactions (create/drag/reschedule); telehealth launch.

## Phase 8 — Clinical documentation
- Notes API (BIRP/DAP/SOAP/group); co-sign workflow; templates.
- Treatment plan editor with goals/objectives progress.

## Phase 9 — AI infrastructure ("Jessie")
- AI service layer (OpenAI/Claude/Gemini) with provider abstraction.
- AI receptionist (scheduling/intake/triage), note generation, dictation.

## Phase 10 — Billing & revenue cycle
- Claims lifecycle, ERA posting, Stripe payments, invoices/statements.

## Phase 11 — Platform & scale
- Redis + BullMQ, S3 storage, WebSockets, Docker, GitHub Actions CI/CD,
  observability, HIPAA controls.

## Priority order (current)
1. Authentication & RBAC hardening
2. Organization / tenant management
3. Clinician dashboard
4. Client management
5. Scheduling & calendar
6. Clinical documentation (BIRP/DAP/SOAP)
7. AI infrastructure for Jessie
8. Billing & insurance foundation
