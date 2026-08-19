# SBOS — Demo Package

Everything needed to run a live SBOS demo for a customer, investor, or
evaluating developer: what the system is, what currently works, how to sign
in, what to click through, and a suggested demo script.

Source of truth for deeper detail: [`docs/SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md),
[`docs/CURRENT_STATUS.md`](CURRENT_STATUS.md), [`docs/API_GUIDE.md`](API_GUIDE.md).
This document is the curated, presentation-ready summary of those.

---

## 1. Architecture Overview

SBOS is a **pnpm + Turborepo monorepo** with five workspaces:

| Package | Path | Stack | Role |
| --- | --- | --- | --- |
| `@sbos/web` | `apps/web` | Next.js 15 · React 19 · Tailwind · shadcn/ui | Customer-facing dashboard |
| `@sbos/api` | `apps/api` | NestJS 10 · REST · Swagger · JWT · RBAC | System of record + business logic |
| `@sbos/database` | `packages/database` | Prisma 6 · PostgreSQL | Schema, migrations, seed |
| `@sbos/core` | `packages/core` | TypeScript | Shared domain rules (RBAC, note-transition, scheduling math) |
| `@sbos/tsconfig` | `packages/tsconfig` | — | Shared TS config |

Runtime shape:

```
Browser ──► web (Next.js, :3000) ──server-side──► api (NestJS, :4000) ──► PostgreSQL
                                                                        └─► Redis (declared in
                                                                             docker-compose,
                                                                             not yet used by code)
```

- **web** is the only public surface; every API call happens server-side
  (Next.js Server Actions / route handlers), never directly from the browser.
- **api** is stateless and horizontally scalable — verified live this session
  (124 routes across 21 controllers, `/api/v1` versioned).
- **PostgreSQL** is the single system of record; every table is
  `organizationId`-scoped for multi-tenancy.
- Three provider-abstracted integration seams — **AI chat** (Jessie),
  **payments**, **email/SMS** — activate a live vendor automatically when its
  API key is set, and fall back to a deterministic offline default otherwise.
  This means the full product demos convincingly with **zero external
  credentials**.

## 2. Features Currently Working

Verified live (build + boot + smoke test, this session, `2026-08-19`):

- **Auth & tenancy** — email/password login, TOTP MFA (QR enrollment,
  two-step login), refresh-token rotation with reuse detection, six-role RBAC
  (`SUPER_ADMIN → ORG_ADMIN → SUPERVISOR → CLINICIAN → BILLING → FRONT_DESK`),
  organization + location management.
- **Client management** — CRUD, search, soft delete/restore, chart view.
- **Scheduling** — appointments (single + recurring series with conflict
  skipping), clinician availability + time-off, open-slot computation,
  waitlist, telehealth session links, check-in/check-out/complete/cancel
  lifecycle.
- **Clinical documentation** — BIRP/DAP/SOAP/progress/group notes with
  draft → sign → co-sign → amend workflow, full version history, AI-assisted
  drafting via Jessie, diagnoses, medications, treatment plans (goals/
  objectives), documents with presigned upload/download + e-sign.
- **Billing** — payers, CPT fee schedule, claims lifecycle (draft → submit →
  accept/deny/pay), invoices with auto-computed line-item totals, payments
  (manual or Stripe), superbill generation.
- **Jessie AI** — multi-assistant router (receptionist / scheduling / intake
  / clinical / knowledge / general), persisted conversation memory, admin
  prompt management, knowledge-base grounding.
- **Enterprise** — tasks, notifications, internal messaging, analytics/KPI
  dashboard, per-tenant feature flags, admin system-health panel.
- **Frontend** — 9 dashboard routes + login, all reading **live API data**
  end-to-end, responsive layout, dark mode, loading skeletons, graceful
  empty/error states, basic accessibility (skip link, landmarks, labeled
  controls).
- **Audit trail** — every sensitive action (sign, create, delete, payment,
  denied delete) writes an immutable `AuditLog` entry.

**Known gaps to disclose if asked:** no automated backups yet, no centralized
log/metrics aggregation yet, Redis is declared in `docker-compose.yml` but not
wired to any code path yet (see the Production Readiness Checklist), and a
full penetration test has not been run. None of these block a demo.

## 3. Current User Flows

**Front desk — book a new client:**
Login → Clients → New Client (form) → Schedule → New Appointment (client +
clinician pickers, conflict-checked) → confirmation SMS fires (console log in
dev, real Twilio SMS if configured).

**Clinician — document a session:**
Login → Schedule/Calendar → open appointment → Start Telehealth (or check-in)
→ Notes → "Generate with Jessie" (AI drafts a BIRP/DAP/SOAP note from context)
→ edit → Sign → note is versioned and audit-logged.

**Billing — close the loop on a visit:**
Billing → Claims → submit a claim → track status (accept/deny/pay) → Invoices
→ generate invoice from line items → record a payment (manual or Stripe) →
Superbill for the client/date range.

**Admin — operate the tenant:**
Settings → manage organization/locations/team → Platform → feature flags,
system-health snapshot (DB probe, table counts, uptime, memory) → Reports →
KPI overview, appointment/claim status breakdowns.

## 4. Demo Login Flow

The seeded demo tenant is **Success Brand Behavioral Health**, created by
`pnpm --filter @sbos/database db:seed`. Two real, database-backed users ship
with it (visible directly on the login screen as a hint):

| Role | Email | Password |
| --- | --- | --- |
| Org Admin | `admin@sbos.health` | `Sbos!2026` |
| Clinician | `clinician@sbos.health` | `Sbos!2026` |

This is **not** a UI-only stub — it's a real `POST /auth/login` against the
live API and a seeded Postgres row (bcrypt-hashed password), so the full
JWT/RBAC/audit path is exercised on every demo login. Re-run the seed command
at any time to reset the demo tenant to a clean state (idempotent).

Do not use these credentials, or ship a demo seed, in any production
environment — see the Production Readiness Checklist.

## 5. API Endpoints Worth Showing

Full interactive reference: **Swagger UI at `http://localhost:4000/docs`**
(also `/docs/json` for the raw OpenAPI document) — the single best thing to
pull up live for a technical audience. 124 routes across 21 resource groups,
all under `/api/v1`. Highlights per group:

| Group | Flagship endpoints |
| --- | --- |
| Health | `GET /health` — no-auth liveness check |
| Auth | `POST /auth/login`, `POST /auth/login/mfa`, `POST /auth/refresh` |
| Clients | `GET /clients` (search/paginate), `POST /clients`, `POST /clients/:id/restore` |
| Appointments | `POST /appointments`, `POST /appointments/recurring`, `POST /appointments/:id/telehealth` |
| Scheduling | `GET /scheduling/slots` (open-slot computation), waitlist + availability endpoints |
| Notes | `POST /notes`, `POST /notes/:id/sign`, `GET /notes/:id/versions` |
| Billing | `POST /billing/claims`, `POST /billing/claims/:id/submit`, `POST /billing/payments` |
| Jessie | `POST /jessie/conversations/:id/messages` (routes to the correct assistant, AI or heuristic) |
| Analytics | `GET /analytics/overview` — the numbers behind the Reports screen |
| Platform | `GET /platform/system-health` — admin-only live infra snapshot |

For a developer audience, also show: consistent pagination/error envelope
across every list endpoint, the RBAC 403 on an under-privileged role, and the
401 on an unauthenticated call.

## 6. Screens / Screenshots Needed

Capture in this order (matches the suggested demo sequence below) — each is a
real, live-data screen today, not a mockup:

1. **Login** (`/login`) — shows the demo credential hint
2. **Dashboard** (`/dashboard`) — KPI tiles, today's appointments, tasks
3. **Schedule** (`/schedule`) — day/list view, conflict-checked booking dialog
4. **Calendar** (`/calendar`) — month grid
5. **Clients** (`/clients`) and a **client detail** page (`/clients/[id]`)
6. **Notes** (`/notes`) — list, and a note detail (`/notes/[id]`) mid-sign
7. **Billing** (`/billing`) — claims + invoices tabs
8. **Reports** (`/reports`) — analytics KPIs
9. **Settings** (`/settings`) — org/team tabs
10. **Swagger UI** (`/docs`) — for technical/investor-diligence audiences

## 7. Sales Demo Sequence (~15–20 minutes)

1. **Open with the problem** (1 min) — behavioral-health practices juggle
   scheduling, clinical documentation, and billing across disconnected tools.
2. **Login** (1 min) — show the real auth flow (JWT, RBAC) via the demo
   credentials; mention MFA is available.
3. **Dashboard** (2 min) — "this is what a clinician sees the moment they log
   in" — today's schedule, open tasks, KPIs.
4. **Book a client end-to-end** (4 min) — New Client → New Appointment,
   narrate the conflict-detection and confirmation-SMS hook.
5. **Clinical documentation** (4 min) — open the appointment, hit **Generate
   with Jessie**, show the AI-drafted BIRP note, edit, sign — emphasize the
   version history and audit trail this creates automatically.
6. **Billing loop** (3 min) — submit a claim, generate an invoice, record a
   payment — "one system, not three."
7. **Analytics + admin** (2 min) — Reports KPIs, then Platform → system-health
   for a technical/investor audience ("here's the operational visibility").
8. **Close** (1–2 min) — Swagger docs if the audience is technical; otherwise
   recap the six modules covered and take questions.

Keep a terminal ready with `docker compose up` (or the two `pnpm dev`
commands) running before the call starts — see the Production Readiness
Checklist for exact commands.
