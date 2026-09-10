SBOS Monorepo — Comprehensive Analysis Report
================================================================================

1. OVERALL DIRECTORY STRUCTURE
--------------------------------------------------------------------------------

Top-level entries:
  .dockerignore, .env.docker.example, .env.production.example
  .git/ .github/ .gitignore
  .turbo/                     (Turborepo task router config)
  apps/                       (3 NestJS/Next.js applications)
    api/                      (NestJS 10 backend API)
    service-operations/       (ops utilities, minimal source)
    web/                      (Next.js 15 React front end)
  CONTRIBUTING.md
  docker-compose.yml
  docs/                       (18 documentation files)
  infrastructure/             (empty — reserved for future infra config)
  JU_BAA_VENDOR_MATRIX.md     (BAA/HIPAA vendor tracking)
  JU_CLEARINGHOUSE_ENROLLMENT_CHECKLIST.md  (clearinghouse transaction coverage)
  JU_MEDICAL_COMPLETION_RECEIPT.md  (parity completion status)
  JU_MEDICAL_CONNECTOR_WORKER_PACKET.md (connector worker task rules)
  JU_MEDICAL_INTEGRATION_PARITY.md  (vendor/clearinghouse parity manifest)
  JU_MEDICAL_SHARED_PARITY_PROMPT.txt
  JU_SBOS_PARITY_AGENT.log
  JU_VENDOR_REGISTRATION_CHECKLIST.md  (code vs. owner gates)
  LICENSE
  node_modules/
  package.json                (root: pnpm + Turborepo config)
  packages/                   (3 shared packages)
    core/                     (@sbos/core — shared domain primitives)
    database/                 (@sbos/database — Prisma schemas + client)
    tsconfig/                 (@sbos/tsconfig — shared TS base config)
  PROJECT_MASTER_PLAN.md
  PROJECT_STATUS.md
  README.md                   (SBS — Success Brand Operating System)
  RELEASE_1_CHECKLIST.md
  turbo.json                  (Turborepo task pipeline: build, typecheck, dev, lint, test)
  pnpm-workspace.yaml         (pnpm workspace definitions)
  pnpm-lock.yaml

2. REPO IDENTIFICATION — JU MEDICAL SUITE: SBOS
--------------------------------------------------------------------------------

This repository is the **SBOS (Success Brand Operating System)** monorepo, which is
one of the three JU medical suite apps. The other two (HealthOS, ClaimFlow) are not
present in this repo — this repo IS the SBOS platform.

Evidence:
- package.json name: "sbos"
- README.md: "# SBOS — Success Brand Operating System — A production-grade behavioral
  health operating system: scheduling, clinical documentation, billing, and analytics"
- JU_MEDICAL_INTEGRATION_PARITY.md: "This manifest applies to the SBOS (Success Brand
  Operating System) monorepo, a behavioral-health practice-management SaaS platform."
- JU_MEDICAL_COMPLETION_RECEIPT.md: "Project: JU Medical Suite Parity Completion, App: SBOS"
- All JU documents reference SBOS specifically; no HealthOS or ClaimFlow code exists here
- The three JU medical apps are:
  1. SBOS — this repo (behavioral health OS)
  2. HealthOS — not in this repo
  3. ClaimFlow — not in this repo

3. EXISTING INTEGRATION / BILLING / CONNECTOR CODE
--------------------------------------------------------------------------------

This is the most complete area of the repo. Full-spectrum integration code exists:

3.1 Vendor EHR/PMS Connectors (10 vendors under apps/api/src/integrations/vendors/):
  - vendor-connector.base.ts — Abstract base class with OAuth state machine (authorize,
    refresh, revoke), status tracking, audit logging, retry backoff, and healthCheck
  - simple-practice.connector.ts — SimplePractice OAuth 2.0 synthetic mock with
    demographics, appointments, 837P claim submission, 270/271 eligibility, 835 ERA
  - epic.connector.ts — Epic EHR synthetic mock with FHIR R4 abstraction, OAuth 2.0/JWT,
    demographics, appointments, 837P claims, 270/271 eligibility, 835 ERA, syncFhirResources
  - athenahealth.connector.ts — AthenaHealth API synthetic mock (OAuth 2.0, 837P/270-271/X12,
    demographics, appointments, ERA)
  - cerner.connector.ts — Cerner FHIR synthetic mock (OAuth 2.0/SMART on FHIR, 837P/270-271/X12,
    demographics, appointments, ERA, FHIR resource sync)
  - eclinicalworks.connector.ts — eClinicalWorks synthetic mock (SMART on FHIR, 837P/270-271/X12,
    demographics, appointments, ERA)
  - nextgen.connector.ts — NextGen Healthcare synthetic mock (OAuth 2.0, 837P/270-271/X12,
    demographics, appointments, ERA)
  - veradigm.connector.ts — Veradigm/Allscripts synthetic mock (SMART on FHIR, 837P/270-271/X12,
    demographics, appointments, ERA)
  - generichl7.connector.ts — Generic HL7 v2 interface adapter skeleton (synthetic demo mode only)

3.2 Clearinghouse Adapters (3 under apps/api/src/integrations/clearinghouses/):
  - generic-x12.connector.ts — Generic X12 transport (all 7 transaction families: 270, 271, 837P,
    276, 277, 835, 837I). No external enrollment needed; pure X12 schema compliance.
  - availity.connector.ts — Availity synthetic adapter (270/271, 837P, 276/277, 835). OAuth 2.0.
  - change-healthcare.connector.ts — Change Healthcare / Optum synthetic adapter
    (270/271, 837P, 276/277, 835). OAuth 2.0 / proprietary auth.

3.3 X12 Transaction Library (apps/api/src/integrations/x12/):
  - x12-generator.service.ts — Generates valid X12 5010 X12 messages for all 4 transaction families:
    270 (eligibility inquiry), 271 (eligibility response), 837P (professional claims),
    276 (claim status inquiry), 277 (claim status response), 835 (ERA/remittance).
    Synthetic round-trip tested (generate → parse → verify integrity).
  - x12-parser.service.ts — Parses X12 messages back to SBOS internal models.
    Extracts: claimNumber, transactionSetId, amount, cptCode, icd10Codes, status,
    patientMemberId, serviceDate.
    verifyRoundTrip() method validates generated→parse→integrity.

3.4 SMART on FHIR R4 Boundary (apps/api/src/integrations/smart/):
  - smart-oauth.service.ts — OAuth 2.0 authorization code flow, token refresh, revocation.
    Synthetic token issuance (sjf_ prefix). No real API calls.

3.5 Integration Administration (apps/api/src/integrations/admin/):
  - integration-admin.service.ts — Connect/disconnect vendors, clearinghouses, SMART on FHIR.
    Factory pattern: creates correct connector type based on vendor string.
    Synthetic authorization in demo mode.
  - integration-config.service.ts — Per-tenant config with status enum:
    CODE_READY / AUTOMATED_TESTED / SANDBOX_VERIFIED / PRODUCTION_VERIFIED.
    Registered connectors stored in Map keyed by tenantId. Health checks, audit logging,
    disconnect/revoke flows.

3.6 Payments (apps/api/src/payments/):
  - payment-provider.interface.ts — PaymentProvider abstraction (charge, refund).
  - PAYMENT_PROVIDER — NestJS provider token for dependency injection.
  - manual-payment.provider.ts — Default provider: records cash/check/external payments
    as SUCCEEDED. No external API calls.
  - stripe-payment.provider.ts — Stripe-backed provider (when STRIPE_SECRET_KEY configured).
    Creates PaymentIntents via HTTP POST to api.stripe.com/v1.
  - payments.module.ts — Binds PAYMENT_PROVIDER to ManualPaymentProvider by default;
    swaps to Stripe when stripe.secretKey is configured.

3.7 Billing Module (apps/api/src/modules/billing/):
  - ClaimsService — Create/find claims; submit status transitions; update status
    (accept/deny/pay) with full audit logging.
  - InvoicesService — Create invoices with line items; compute subtotal/tax/total;
    track amountPaid/balanceDue/status (OPEN/PARTIALLY_PAID/PAID).
  - BillingReferenceService — Payer management (create/list/update); CPT fee schedule
    (service codes with defaultFee and defaultUnits).
  - SuperbillsService — Generates superbill from claims in a date range (for out-of-network
    reimbursement). Includes organization NPI/taxId and client demographic info.
  - BillingController — HTTP routes: payers, service-codes, claims, invoices, payments,
    superbills. Role-gated (BILLING role required for most actions).
  - DTOs: CreateClaimDto, UpdateClaimStatusDto, CreateInvoiceDto, RecordPaymentDto,
    CreatePayerDto, CreateServiceCodeDto.

3.8 Audit Infrastructure (apps/api/src/audit/):
  - audit.module.ts, audit.service.ts — Every connector action, payment, claim, and
    admin operation records to an AuditLog model scoped by organizationId. Captures
    actorId, action, entityType, entityId, metadata (with PHI redaction).

4. TECH STACK — FROM CONFIG FILES
--------------------------------------------------------------------------------

4.1 Root package.json:
  - name: "sbos"
  - private: true
  - packageManager: "pnpm@11.17.0"
  - scripts: build (turbo), dev (turbo), lint (turbo), test (turbo)
  - devDependencies: turbo ^2.10.6, typescript ^7.0.2

4.2 pnpm-workspace.yaml:
  - packages: ["apps/*", "packages/*"]
  - allowBuilds: sharp, @prisma/client, @prisma/engines, prisma, esbuild,
    @nestjs/core, @scarf/scarf

4.3 turbo.json:
  - Tasks: build (dependsOn ^build, outputs: dist/**, .next/**, !.next/cache/**),
    typecheck (dependsOn ^build), dev (cache: false, persistent: true),
    lint (dependsOn ^build), test (dependsOn ^build, outputs: [])

4.4 Tech Stack by component (from README.md, FINAL_REPORT.md, and source code):

  Web app (@sbos/web, apps/web):
    - Next.js 15 + React 19
    - Tailwind CSS 3
    - @radix-ui/* components (avatar, dialog, dropdown-menu, label, separator, slot, tabs)
    - shadcn/ui primitives
    - class-variance-authority, clsx, tailwind-merge, tailwindcss-animate
    - lucide-react, next-themes
    - jose (JWT/cookies), @tanstack/react-query
    - react-hook-form, zod (validation), sonner (toasts)
    - server-only

  API (@sbos/api, apps/api):
    - NestJS 10
    - @nestjs/common, @nestjs/core, @nestjs/config, @nestjs/jwt, @nestjs/passport,
      @nestjs/platform-express, @nestjs/swagger, @nestjs/throttler
    - passport, passport-jwt
    - bcryptjs, class-validator, class-transformer
    - helmet, reflect-metadata, rxjs
    - vitest (test runner)

  Database (@sbos/database, packages/database):
    - Prisma 6 + PostgreSQL
    - 29 models (grown to 41+ across phases), 27+ enums
    - Multi-tenant via organizationId
    - Migrations + seed

  Shared core (@sbos/core, packages/core):
    - Shared domain primitives: clinical role satisfaction, money rounding,
      scheduling logic (recurrence, window overlap)
    - Unit tests (5 passing at last report)
    - TypeScript 7.0.2

  Shared TS config (@sbos/tsconfig, packages/tsconfig):
    - base.json shared config

  Testing runner: vitest (Node environment), esbuild target es2022 for decorator support

5. TEST INFRASTRUCTURE
--------------------------------------------------------------------------------

5.1 Vitest configuration (apps/api/vitest.config.ts):
  - environment: node
  - include: ['src/**/*.spec.ts']
  - globals: false
  - esbuild: target es2022 (for NestJS decorator parsing)

5.2 Existing test files (vitest .spec.ts):

  API integration tests (apps/api/src/integrations/__tests__/):
    - x12-generator.service.spec.ts — X12 generation + parse round-trip assertions
    - x12-parser.service.spec.ts — Parsing + field extraction assertions
    - vendor-connector.base.spec.ts — Status tracking, config, audit events
    - simple-practice.connector.spec.ts — Synthetic mapping, no PHI
    - availity.connector.spec.ts — Transaction family parsing, synthetic mode
    - smart-oauth.service.spec.ts — OAuth state machine, token refresh/revoke

  Core package unit tests (packages/core/src/):
    - clinical.test.ts — roleSatisfies, isNoteEditable, noteStatusAfterSign
    - money.test.ts — roundCurrency (rounds to 2 decimals)
    - scheduling.test.ts — windowsOverlap, advanceByFrequency, expandRecurrence,
      minutesFromHHmm

  API guard tests (apps/api/src/common/guards/):
    - jwt-auth.guard.spec.ts — Public route short-circuit, Passport delegation
    - roles.guard.spec.ts — roleSatisfiesAny hierarchy, unauthenticated rejection

  Payment provider tests (apps/api/src/payments/):
    - manual-payment.provider.spec.ts — provider name, charge with/without reference,
      unique processorRef generation, refund
    - stripe-payment.provider.spec.ts — Stripe HTTP POST, amount-to-cents conversion,
      refund status mapping, error handling, secret key redaction

5.3 Test coverage summary (from FINAL_REPORT.md):
  - `turbo run lint` (tsc typecheck) → 6/6 successful
  - API verified via live smoke test (auth, RBAC 403, unauth 401, docs 200)
  - No full automated unit test suite yet (runners execute cleanly with 0 tests —
    planned, but many targeted tests exist as shown above)
  - Core package: 5 passing unit tests
  - All new vendor connector test suites are synthetic, no-PHI patterns

6. DOCUMENTATION FILES (JU_MEDICAL_*.md and other docs)
--------------------------------------------------------------------------------

6.1 JU Medical documentation files (at repo root):

  JU_MEDICAL_INTEGRATION_PARITY.md — 126 lines
    Vendor adapter status map (11 vendors all CODE-READY)
    Clearinghouse status map (3 clearinghouses all CODE-READY)
    Technical release standard checklist (10 items all ✅)
    Data/capability mapping table
    Implementation priority (high-priority all ✅ completed)
    Low-priority post-release items
    Synthetic mode enforcement
    Remaining external blockers

  JU_MEDICAL_CONNECTOR_WORKER_PACKET.md — 27 lines
    Task rules: one writer, free model only
    Scope: provider-neutral connector abstraction, SMART on FHIR/OAuth,
    tenant isolation, connection status/health model, audit events
    Acceptance criteria: HEARTBEAT_MEDICAL_CONNECTOR.md first, then inspect
    existing architecture/tests, add smallest safe implementation + focused tests,
    write completion receipt

  JU_MEDICAL_COMPLETION_RECEIPT.md — 163 lines
    Status summary: Vendor Connectors (all code-ready/automated-tested/sandbox-verified),
    Clearinghouse Adapters (all code-ready), Billing/Claims Lifecycle,
    Admin Configuration (placeholders implemented)
    Code changes documented (X12 library, vendor connectors, clearinghouse adapters,
    SMART on FHIR boundary, admin config service, synthetic mocks, tests, admin UI)
    Testing verification (18 check items)
    Remaining external blockers (not code-deliverable)
    Next human gates (6 items)

  JU_BAA_VENDOR_MATRIX.md — 95 lines
    BAA / HIPAA matrix for all 9 vendors + 3 clearinghouses
    Code-integrated status, BAA status, HIPAA status
    Code vs. legal gate distinction (what code can deliver vs. what requires owner action)
    Remaining external blockers + next human gates

  JU_VENDOR_REGISTRATION_CHECKLIST.md — 152 lines
    Code-completable items (7 items): vendor profile creation, base URL/tenant/config,
    OAuth/SMART auth, synthetic connectivity testing, synthetic resource sync,
    health/errors/retry display, reconnect/revoke/disconnect
    Owner/external vendor gates (13 items): vendor account registration, client ID/secret
    acquisition, MFA, BAA execution, payer submitter/payer IDs, HIPAA confirmation,
    terms of use signing, redirect URL configuration

  JU_CLEARINGHOUSE_ENROLLMENT_CHECKLIST.md — 173 lines
    Covered transaction families (270/271, 837P, 276/277, 835 — all ✅ synthetic/demo mode)
    Provider-neutral clearinghouse adapters (Availity, Change Healthcare, Generic X12)
    X12 transaction family details (each of 4 families with segments, synthetic data)
    837I institutional extension points (code-ready for extension, production support separate)
    Admin configuration pattern (7-item UI pattern)
    Synthetic mode enforcement
    Remaining external blockers

6.2 Other key documentation (docs/):

  FINAL_REPORT.md — 213 lines (generated 2026-07-24)
    Phases 1-10 delivery summary
    All packages build and typecheck clean
    ~86% platform completion
    Web ↔ API integration + live-data UI verified

  SYSTEM_ARCHITECTURE.md — 85 lines
    High-level topology diagram (web → API → Prisma → PostgreSQL)
    Workspace table (5 packages + service-operations)
    Front end, back end, data layer details
    Planned infrastructure (Redis, S3, Stripe, AI services)

  ROADMAP.md — 59 lines
    Phased delivery plan (phases 1-4 complete; 5-11 remaining)
    Priority order: auth/RBAC hardening, org/tenant management, clinician dashboard,
    client management, scheduling, clinical documentation, AI infrastructure, billing

  AI_CONFIGURATION.md — 109 lines
    Jessie AI provider abstraction (OpenAI-compatible / offline default)
    Provider selection table (env keys per capability)
    Chat/LLM, note generation, payments, email, SMS configuration
    Prompt management, knowledge base, conversation memory
    Security & compliance notes (BAA required for PHI)
    Independent licensing notes

  API_GUIDE.md — 119 lines
    Base URL / auth / content type
    Authentication flow (login, refresh)
    Authorization (role-based 401/403)
    Pagination, filtering, error envelopes
    Error codes (400-429)
    Versioning, common flows (create client → schedule → document, Ask Jessie)

  INSTALL.md — 93 lines
    Prerequisites (Node 24+, pnpm 11+, PostgreSQL 14+)
    Install steps (clone, pnpm install, cp .env.example, prisma generate/deploy/seed)
    Docker compose alternative
    Build/lint/test commands

  RELEASE_1_CHECKLIST.md — (not fully read but referenced)
    Enumerates everything required before go-live

  PROJECT_STATUS.md, CONTRIBUTING.md, DECISIONS.md, CURRENT_STATUS.md, DATABASE_SCHEMA.md,
  DATABASE_REVIEW.md, FEATURE_REQUIREMENTS.md, DEPLOYMENT.md, SECURITY.md, PLAN_CLIENT_SOFT_DELETE.md

CONCLUSION
--------------------------------------------------------------------------------

This SBOS monorepo is a production-grade behavioral health operating system built as a
pnpm + Turborepo monorepo. It contains comprehensive, code-complete integration for 11
vendor EHR/PMS connectors (SimplePractice, Epic, athenahealth, Cerner, eClinicalWorks,
NextGen, Veradigm, plus generic SMART on FHIR R4 and generic HL7 v2 adapters), 3 clearinghouse
adapters (Availity, Change Healthcare, generic X12), a full X12 transaction library covering
all 4 transaction families (270/271 eligibility, 837P professional claims, 276/277 claim status,
835 ERA), and a complete billing module with claims lifecycle, invoices, payments (manual +
Stripe), and superbills.

The platform is ~86% complete. All integration code is synthetic/demo mode only — no real
PHI transmission or external vendor API calls occur without explicit admin opt-in and
proper vendor credentials/BAAs. The remaining ~14% consists of infrastructure provisioning
(managed DB, secrets store, TLS), credentials for live providers, and organizational/compliance
steps (MFA, BAAs, payer IDs, HIPAA confirmation) all documented in the JU checklists and
the RELEASE_1_CHECKLIST.md.

Key code architecture patterns:
- VendorConnectorBase abstract class with OAuth state machine, status tracking, audit, retry
- X12GeneratorService / X12ParserService for all X12 transaction families
- IntegrationConfigService with per-tenant connector registry and status tracking
- IntegrationAdminService factory pattern for connecting/disconnecting vendors/clearinghouses
- PaymentProvider abstraction (manual default, Stripe-swappable)
- Multi-tenancy scoped by organizationId across all connector actions and audit logs
- Synthetic mode enforcement: no real transmission without explicit opt-in