# SBOS — Feature Requirements

SBOS aims to exceed SimplePractice, TherapyNotes, Valant, Kareo, Athenahealth,
and Sessions Health. This document tracks the target feature set and its
status.

Legend: ✅ implemented · 🟡 partial/scaffolded · ⬜ planned

## Platform foundation
- ✅ Monorepo (pnpm + Turborepo)
- ✅ TypeScript across all packages
- ✅ Shared config & design system
- 🟡 Docker / CI (GitHub Actions) — planned
- ⬜ Redis + BullMQ background jobs
- ⬜ S3-compatible document storage
- ⬜ WebSocket realtime layer

## Authentication & access
- ✅ JWT auth (access + refresh)
- ✅ Password hashing (bcrypt)
- ✅ Role-based access control (6-role hierarchy)
- ✅ Route protection (web middleware + API guards)
- ✅ Rate limiting
- ⬜ Multi-factor authentication (schema fields present)
- ⬜ SSO / SAML

## Multi-tenancy & organizations
- ✅ Organization model & tenant isolation (`organizationId`)
- 🟡 Organization settings UI (Settings module)
- ⬜ Organization CRUD API
- ⬜ Location management API

## Users, roles & staff
- ✅ User model + roles
- 🟡 Users API (list/create/get/me)
- ⬜ Staff management UI
- ⬜ Credentialing & license tracking
- ⬜ Payroll hooks

## Clinicians & clients
- ✅ Clinician & Client models
- 🟡 Clients module UI (roster, search, statuses)
- ⬜ Client chart / detail view
- ⬜ Admissions workflow
- ⬜ Assessments (PHQ-9, GAD-7) capture & scoring

## Scheduling
- ✅ Appointment model (types, statuses, recurrence, telehealth)
- 🟡 Schedule (day agenda) & Calendar (month grid) UI
- ⬜ Drag-to-reschedule, availability, waitlist
- ⬜ Recurring appointment generation
- ⬜ Telehealth session launch

## Clinical documentation
- ✅ Note models (BIRP, DAP, SOAP, group, intake, discharge)
- ✅ Treatment Plans → Goals → Objectives model
- 🟡 Notes module UI + interactive BIRP/DAP/SOAP composer
- ⬜ Note co-signing workflow
- ⬜ AI note generation & voice dictation
- ⬜ Template library management

## Billing & revenue cycle
- ✅ Insurance, Claim, Invoice, Payment models
- 🟡 Billing module UI (claims + invoices tables, A/R stats)
- ⬜ Claim submission (837/EDI) & ERA posting
- ⬜ Stripe payment processing
- ⬜ Statements & superbills

## Collaboration
- ✅ Task, Message, Notification, Document models
- 🟡 Tasks surfaced on dashboard
- ⬜ Secure messaging UI
- ⬜ Document upload/e-sign

## Reporting & analytics
- 🟡 Reports module (utilization, KPIs)
- ⬜ Revenue, outcomes, compliance reports with export

## AI & differentiators
- ⬜ "Jessie" AI receptionist (scheduling, intake, triage)
- ⬜ AI-assisted clinical notes
- ⬜ Voice dictation
- ⬜ VR therapy integration

## Compliance
- ✅ Audit log model
- ⬜ HIPAA controls (encryption at rest, BAA, access reports)
- ✅ Accessible, responsive UI foundation (light/dark)
