# SBOS — Project Master Plan

**The canonical roadmap for the Success Brand Operating System.**
_Last updated: 2026-07-25 · Status: Release Candidate 1 (pending final infra/compliance)_

This document supersedes ad-hoc status notes as the single source of truth for
where SBOS is and where it is going. Point-in-time status lives in
`docs/CURRENT_STATUS.md`; the go-live gate lives in `RELEASE_1_CHECKLIST.md`.

---

## 1. Executive Summary

SBOS is a **multi-tenant SaaS behavioral-health operating system** — an EHR +
practice-management platform designed to exceed SimplePractice, TherapyNotes,
Valant, Kareo, and Athenahealth in usability, automation, and AI. It is a
product in its own right; **SuccessBrand is Tenant #1**, never hardcoded.
**Jessie AI** is a proprietary, provider-abstracted assistant layer built to be
licensable independently.

**Where we are:** the full application is built and verified end-to-end against a
real database — authentication/RBAC, multi-tenancy, the complete clinical record
(scheduling, BIRP/DAP/SOAP documentation with sign/co-sign/versioning, treatment
plans, diagnoses, medications, documents), the billing/revenue cycle, the Jessie
AI platform, and enterprise features (tasks, messaging, notifications,
analytics, feature flags). A production-readiness pass added security hardening,
DB indexing, complete OpenAPI, accessibility/loading states, hardened
containers, CI, and a full documentation set.

**Where we are going:** infrastructure provisioning, credentialed provider
activation, compliance (HIPAA), and the growth roadmap (SaaS self-serve, mobile,
deeper AI, integrations).

**Completion:** application ~**86%**; remaining work is largely
infrastructure/compliance/credentials (see §8–11).

---

## 2. Current Architecture

**Monorepo** (pnpm + Turborepo): `apps/web`, `apps/api`, `packages/database`,
`packages/core`, `packages/tsconfig`.

```
Browser ─► apps/web (Next.js 15 / React 19 / RSC)
             │  server-side, HttpOnly cookies + middleware refresh
             ▼
           apps/api (NestJS 10, /api/v1, 118 routes, Swagger /docs)
             │  Prisma
             ▼
           PostgreSQL   (Redis provisioned for the planned queue/cache layer)
```

- **Front end:** Next.js App Router (server components), Tailwind + shadcn/ui,
  TanStack Query, React Hook Form + Zod, dark mode, Server Actions for writes.
- **API:** NestJS, URI-versioned, global JWT + hierarchical RBAC guards,
  validation, rate limiting, Helmet, consistent error envelope, provider
  abstractions (Jessie chat, payments, storage, email, SMS).
- **Data:** Prisma + PostgreSQL, **41 models**, 7 additive migrations, composite
  indexes, per-tenant isolation via `organizationId`.
- **Shared logic:** `@sbos/core` (RBAC, note-status, scheduling, money) — unit
  tested, consumed by the API so business rules live once.

See `docs/SYSTEM_ARCHITECTURE.md` and `docs/DATABASE_REVIEW.md` for detail.

---

## 3. Feature Matrix

✅ shipped · 🔶 partial · ⬜ planned

| Domain | Capability | Status |
| --- | --- | --- |
| Platform | Multi-tenancy, org isolation | ✅ |
| Auth | JWT access+refresh, bcrypt, RBAC (6 roles) | ✅ |
| Auth | MFA (TOTP) enrollment + two-step login | ✅ |
| Auth | SSO/SAML | ⬜ |
| Orgs | Organization + Location management | ✅ |
| Staff | Users/roles; clinician profiles | ✅ |
| Staff | Credentialing, payroll hooks | ⬜ |
| Clients | Roster, chart, admissions, assessments | ✅ / 🔶 |
| Scheduling | Appointments, recurrence, availability, waitlist, check-in/out, telehealth session | ✅ |
| Scheduling | Drag-reschedule UI, calendar sync (Google/O365) | ⬜ |
| Clinical | BIRP/DAP/SOAP/progress/group notes | ✅ |
| Clinical | Sign / co-sign / amend / version history / audit | ✅ |
| Clinical | Treatment plans, goals, objectives, diagnoses, meds | ✅ |
| Clinical | AI note generation, voice dictation | 🔶 / ⬜ |
| Documents | Upload (presigned), e-sign, storage abstraction | ✅ |
| Billing | Payers, CPT fee schedule, claims, invoices, payments, superbills | ✅ |
| Billing | EDI 837/835 (real clearinghouse), ERA auto-post | ⬜ |
| Jessie AI | Assistants, memory, prompts, knowledge base | ✅ |
| Jessie AI | Live LLM, voice assistant, workflow automation | 🔶 / ⬜ |
| Enterprise | Tasks, notifications, messaging, analytics, feature flags, system health | ✅ |
| UX | Responsive, dark mode, a11y, loading/empty/error states | ✅ |
| Ops | Docker, Compose, CI, health checks | ✅ |

---

## 4. Remaining Features

Prioritized, credential-free first:

1. ✅ **MFA (TOTP)** enrollment + two-step login — _done_.
2. ✅ **Refresh-token rotation & revocation** (reuse detection) — _done_.
3. **Client detail write flows** — edit demographics, add diagnosis/med inline.
4. **Calendar interactions** — drag-to-reschedule, availability overlay.
5. **AI note generation in the composer** (wire the existing `/notes/generate`).
6. **Reporting exports** (CSV/PDF) and saved report definitions.
7. **Voice dictation & Jessie voice** (requires speech provider).
8. **EDI/clearinghouse billing** and ERA auto-posting.
9. **Client portal** (self-scheduling, forms, secure messaging).
10. **Admissions & assessments** full workflow (PHQ-9/GAD-7 scoring UI).

---

## 5. Technical Debt

Tracked honestly. Resolved during the RC1 review are struck through.

- ~~Dead `ROLE_HIERARCHY` constant~~ → removed (hierarchy lives in `@sbos/core`).
- ~~Leftover `apps/service-operations` scaffolding + example primitives~~ → removed.
- ~~Duplicated money `round()` in billing services~~ → unified as
  `@sbos/core#roundCurrency` (tested).
- **DTO enum duplication (accepted):** request DTOs redeclare enums
  (`GenderDto`, `ClientStatusDto`, …) rather than importing Prisma enums. This is
  a deliberate decoupling of the API contract from the DB and gives Swagger
  concrete enums; revisit if it becomes a maintenance burden.
- **Minor helper duplication:** `titleCase` exists privately in two AI/notes
  files; low value to unify.
- **Test coverage is thin** — unit tests cover `@sbos/core`; services/guards and
  e2e flows need coverage (biggest real debt).
- **No shared API client types** between web and api — the web redeclares
  response shapes inline. A generated client (from OpenAPI) or a shared types
  package would remove drift.
- **`packages/database` seed** hardcodes a bcrypt hash and demo org — fine for
  dev, must not run in production.

---

## 6. Infrastructure Requirements

| Component | Purpose | Status |
| --- | --- | --- |
| PostgreSQL (managed) | System of record | Provision |
| Redis | Queue (BullMQ) + rate-limit/cache store | Provisioned in Compose; wire in app |
| S3-compatible storage | Documents (real bucket) | Abstraction ready; provision bucket |
| Load balancer + TLS | Public ingress | Provision |
| Container registry | Image hosting | Provision |
| Secrets manager | JWT/provider secrets | Provision |
| Log aggregation + metrics + error tracking | Observability | Provision |
| Automated backups | DR | Provision + test restore |
| CDN | Static assets | Optional |

---

## 7. Third-Party Services

| Service | Use | Integration status |
| --- | --- | --- |
| OpenAI / Azure OpenAI / compatible | Jessie chat + note gen | Adapter built; needs key + BAA |
| Stripe | Card payments | Adapter built; needs key + client checkout |
| Resend | Transactional email | Adapter built; needs key + domain |
| Twilio | SMS (+ future voice) | Adapter built; needs credentials |
| Clearinghouse (e.g. Availity/Change) | EDI claims | ⬜ Not started |
| Speech-to-text (Deepgram/Whisper) | Dictation | ⬜ Not started |
| Google/Microsoft Calendar | Calendar sync | ⬜ Not started |

All existing adapters activate on env key and fall back to offline defaults
(see `docs/AI_CONFIGURATION.md`).

---

## 8. Production Checklist

The authoritative, itemized gate is **`RELEASE_1_CHECKLIST.md`** (code/CI,
security, DB, API, frontend, deployment, observability, providers, compliance,
pre-launch). Summary of ship-blockers before real PHI:

- Managed DB + tested backups · production secrets in a secret store · TLS +
  CORS · encryption at rest · MFA or compensating control · provider BAAs (if
  enabled) · pre-launch smoke test · logging/monitoring/alerting.

---

## 9. Compliance Checklist (HIPAA-oriented)

- ✅ Technical safeguards: RBAC, tenant isolation, audit log, transport security,
  input validation, minimal error disclosure.
- ⬜ Encryption at rest (DB + backups + document storage).
- ⬜ MFA for workforce accounts.
- ⬜ BAAs with hosting and each enabled subprocessor (LLM/Stripe/Resend/Twilio).
- ⬜ Administrative: policies, workforce training, periodic access reviews.
- ⬜ Breach-notification procedure; data-retention & disposal policy.
- ⬜ Audit-log review cadence + tamper-evidence/export.
- ⬜ Risk assessment + penetration test before go-live.

---

## 10. Security Roadmap

- **RC1 (done):** Helmet, RBAC, tenant scoping, validation, rate limiting,
  fail-fast config, consistent errors, audit log, OWASP Top 10 review
  (`docs/SECURITY.md`).
- **Near-term:** MFA (TOTP); refresh-token rotation + revocation; dependency
  scanning + CodeQL in CI; container image scanning; secrets manager.
- **Mid-term:** field-level PHI encryption; per-tenant data-export/delete
  (portability); anomaly detection on auth; WAF.
- **Long-term:** SOC 2 Type II; HITRUST; automated compliance evidence.

---

## 11. Deployment Roadmap

- **RC1 (done):** multi-stage images (non-root, healthchecks), Compose stack,
  GitHub Actions (build/lint/test + image builds), env templates, auto-migrate.
- **Next:** push images to a registry; deploy to Railway/AWS; managed Postgres +
  Redis; blue/green or rolling deploys; release-gated migrations.
- **Then:** infra-as-code (Terraform), autoscaling, multi-region, DR runbook,
  staging environment mirroring production.

---

## 12. SaaS Roadmap

- **Self-serve onboarding:** public signup → new organization provisioning →
  guided setup wizard (locations, users, fee schedule, prompts).
- **Billing & plans:** subscription tiers via Stripe Billing; usage metering
  (seats, AI usage); trials; dunning.
- **Tenant lifecycle:** suspend/reactivate, data export, hard-delete with audit.
- **Entitlements:** feature flags → plan-based gating.
- **Admin console:** cross-tenant `SUPER_ADMIN` operations, impersonation with
  audit, per-tenant metrics.

---

## 13. Jessie Roadmap

- **RC1 (done):** assistant router, conversation memory, prompt management,
  knowledge base, LLM adapter, audit.
- **Next:** live LLM enablement + guardrails/PII redaction; AI note generation in
  the clinical composer; retrieval over the knowledge base (embeddings).
- **Then:** **AI receptionist voice** (telephony + STT/TTS), scheduling actions
  (Jessie books/reschedules through the API), intake automation, workflow
  automation (triggers → actions), AI analytics/insights.
- **Product:** package Jessie as a standalone, licensable service with its own
  API surface, billing, and SDK.

---

## 14. Mobile App Roadmap

- **Phase 1:** responsive PWA (installable; offline read cache) from the existing
  web app.
- **Phase 2:** React Native (Expo) client reusing `@sbos/core` and the REST API —
  clinician-first: schedule, client chart, notes, tasks, secure messaging,
  push notifications.
- **Phase 3:** client-facing mobile app — appointments, forms, messaging,
  telehealth join, balance/pay.
- **Cross-cutting:** biometric unlock, offline note drafting + sync, device MFA.

---

## 15. Revenue Roadmap

- **Direct SaaS subscriptions** (per-seat tiers) — primary.
- **Usage-based AI** (Jessie chat/voice/note-gen credits).
- **Payments take-rate** (Stripe-processed patient payments).
- **Jessie licensing** to third-party EHRs/practices (standalone).
- **Marketplace** (integrations, templates, assessment libraries) — long-term.
- **Enterprise/agency contracts** (multi-location, custom SLAs, on-prem/VPC).

---

## 16. Version Roadmap

| Version | Theme | Contents |
| --- | --- | --- |
| **v1.0 (RC1)** | Production launch | Core EHR + billing + Jessie (offline/keyed), single-tenant onboarding, hardened + documented |
| **v1.1** | Security & compliance | MFA, token revocation, encryption at rest, scanning, backups/DR |
| **v1.2** | AI live | Live LLM, AI note-gen in composer, KB retrieval |
| **v1.3** | Self-serve SaaS | Signup, subscription billing, entitlements, admin console |
| **v1.4** | Revenue cycle | EDI/clearinghouse, ERA auto-post, statements |
| **v1.5** | Client portal | Self-scheduling, forms, messaging, pay |
| **v2.0** | Mobile + voice | RN apps, Jessie voice receptionist, calendar sync |
| **v2.x** | Scale & platform | Multi-region, marketplace, Jessie-as-a-product |

---

## 17. Future Integrations

- **Clinical:** e-prescribing (Surescripts), labs (HL7/FHIR), state PDMP,
  telehealth video (Daily/Twilio Video), assessment libraries.
- **Billing:** clearinghouses, eligibility (270/271), patient-payment terminals.
- **Ops:** Google/Microsoft Calendar, accounting (QuickBooks), payroll,
  e-sign (DocuSign), analytics/BI export.
- **Platform:** FHIR API for interoperability, webhooks, public REST SDK, Zapier.

---

## 18. Long-Term Vision

SBOS becomes the **operating system for behavioral-health organizations** — from
a solo therapist to a multi-site agency — where day-to-day operations are
increasingly automated by **Jessie**: answering calls, scheduling, running
intake, drafting documentation, chasing claims, and surfacing insights, while
clinicians focus on care. The platform is **HIPAA-compliant, interoperable
(FHIR), and extensible** via a marketplace, and **Jessie is independently
licensable** to the broader health-tech ecosystem. North-star outcomes: less
administrative burden per clinician, faster/cleaner revenue cycle, and better
client access and outcomes — measurably better than any incumbent.

---

_Related: `RELEASE_1_CHECKLIST.md` · `docs/SECURITY.md` · `docs/DATABASE_REVIEW.md`
· `docs/SYSTEM_ARCHITECTURE.md` · `docs/ROADMAP.md` · `docs/CURRENT_STATUS.md`._
