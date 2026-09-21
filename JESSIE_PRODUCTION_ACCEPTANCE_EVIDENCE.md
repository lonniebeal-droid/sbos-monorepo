# Jessie Production Acceptance / Deployment Evidence

**Date:** 2026-09-21
**Branch:** `medical-pr28-review-fixes` (HEAD: `cfcb389`)
**Repository:** `lonniebeal-droid/sbos-monorepo`
**Criteria:** Issue #16 Criterion #8 — deployment/test evidence documented

---

## 1. Dedicated URL Status

| Service | URL | Status | Evidence |
|---------|-----|--------|----------|
| sbos-api (Railway) | `https://sbos-api-production.up.railway.app` | **DOWN** | HTTP 404; Railway `railway status` shows all services FAILED/REMOVED |
| sbos-web (Railway) | `https://sbos-web-production.up.railway.app` | **DOWN** | HTTP 404; Railway `railway status` shows all services FAILED/REMOVED |
| claimflow-demo (Railway) | `https://claimflow-demo-production.up.railway.app` | **DOWN** | HTTP 404 |
| Local API | `http://localhost:4000` | Buildable | `nest build` succeeds; `pnpm --filter @sbos/api test` 301/301 PASS |
| Local Web | `http://localhost:3000` | Buildable | `next build` produces 22 pages; `tsc --noEmit` PASS |

**Railway deployment evidence (from `railway deployment list --service sbos-api`):**
- Most recent deployment `f9ab6548` (2026-09-06): **FAILED**
- Prior deployment `405c2ea9` (2026-09-10): **REMOVED** (was SUCCESS per Issue #26 notes)
- All 19 listed deployments are either FAILED or REMOVED
- No active Railway deployment exists at this time

**Conclusion:** No live production deployment is running. The Railway project "SBOS Demo" exists but all services are down. Railway config is deprecated (`railway.json` → migration to `.railway/railway.ts` required by 2026-12-01).

---

## 2. Mobile / Desktop Smoke Status

**Cannot verify live** — Railway production is down. Local verification only:

| Check | Method | Result |
|-------|--------|--------|
| Web build produces all pages | `next build` | 22 pages generated (see §9) |
| Web type-checks clean | `tsc --noEmit` | PASS |
| API type-checks clean | `tsc --noEmit` | PASS |
| API health endpoint | Unit-tested in `health.controller.ts` | Health check with DB connectivity verified |
| Responsive CSS | Tailwind CSS framework (shadcn/ui) | Standard responsive design patterns |

**Desktop smoke:** Local build produces complete page tree. No live URL to test against.
**Mobile smoke:** Same build output; no separate mobile app exists (responsive web only).

---

## 3. Rep Auth / Lead CRUD

### Authentication (verified in `auth.service.spec.ts` — 27 tests)
- Login with admin credentials → tokens issued ✓
- Login with clinician credentials → tokens issued ✓
- Password reset flow → old password rejected, new password works ✓
- MFA generation, verification, QR data URL ✓
- Refresh token rotation ✓
- Suspended/deactivated/invited user login rejected ✓
- Password versioning in JWT claims ✓

### Client CRUD (verified in `clients.service.spec.ts` — 12 tests)
- Create client with MRN, name, DOB, contact info ✓
- Edit demographics via PATCH ✓
- Persistence verified across operations ✓
- Tenant-scoped: foreign-org client rejected ✓

### Diagnoses CRUD (verified in `diagnoses.service.spec.ts` — 3 tests)
- Add ICD-10 diagnosis ✓
- List with correct count ✓
- Delete with audit trail ✓

### Medications CRUD (verified in `medications.service.spec.ts` — 4 tests)
- Add medication ✓
- List with correct count ✓
- Tenant isolation: foreign-org clientId rejected ✓

### Notes (verified in `notes.service.spec.ts` — 9 tests)
- Generate draft with presentingProblem + interventions ✓
- Enriched sections (behavior, intervention, response, plan) ✓
- Create note with sections, status = DRAFT ✓

### Assessments (verified in `assessments.service.spec.ts` — 8 tests)
- PHQ-9 (score=12, Moderate) ✓
- GAD-7 (score=8, Mild) ✓
- RBAC: CLINICIAN role required for write ✓

---

## 4. Onboarding Intake

| Flow | Status | Evidence |
|------|--------|----------|
| User invite (ORG_ADMIN invites user) | Implemented | `users.service.spec.ts` — invite flow tested |
| User accept invite | Implemented | Auth controller: `acceptInvite` route exists |
| Client intake (create client) | Verified | `clients.service.spec.ts` — create + edit flow |
| Knowledge articles (intake docs) | Verified | `knowledge.service.spec.ts` — CRUD + audit |
| Medical connector setup | Implemented | `medical-connectors.service.ts` — 13-option catalog |

---

## 5. Admin Management

### RBAC (verified in `roles.guard.spec.ts` — 12 tests)
- Role hierarchy: SUPER_ADMIN > ORG_ADMIN > SUPERVISOR > CLINICIAN > BILLING > FRONT_DESK ✓
- ORG_ADMIN satisfies CLINICIAN requirement ✓
- SUPER_ADMIN satisfies all roles ✓
- CLINICIAN cannot satisfy ORG_ADMIN ✓
- BILLING cannot satisfy CLINICIAN ✓
- FRONT_DESK cannot satisfy clinical/admin ✓
- Unauthenticated requests rejected ✓

### Tenant Isolation (verified in `security.spec.ts` — 9 tests)
- Cross-organization client access blocked ✓
- Cross-organization claim access blocked ✓
- Cross-organization appointment access blocked ✓
- Cross-organization note access blocked ✓
- Role-based visibility enforced ✓

### System Health (verified in `system-health.service.spec.ts`)
- Org-scoped counts ✓
- Soft-deleted client exclusion from KPIs ✓

---

## 6. Safe Payment

| Aspect | Status | Evidence |
|--------|--------|----------|
| Stripe integration | Implemented | `STRIPE_SECRET_KEY` env var; `ManualPaymentProvider` fallback |
| Manual fallback | Verified | When Stripe not configured, uses cash/check/external provider |
| Invoice creation tenant guard | Verified | `claims.service.spec.ts` — foreign-client invoice blocked |
| Payment path tenant guard | Verified | Payment cannot charge before tenant ownership validation |
| Live payment processing | **NOT ACTIVE** | No Stripe key configured; no live charges |

**No real payment processing occurs.** ManualPaymentProvider is the default. Stripe is optional and not configured in the deployment environment.

---

## 7. Backend / Demo Integration

### Jessie AI Agent Module
| Component | Status | Evidence |
|-----------|--------|----------|
| Jessie controller | Implemented | `apps/api/src/modules/jessie/jessie.controller.ts` |
| Conversations service | Implemented | `apps/api/src/modules/jessie/conversations.service.ts` |
| Knowledge service | Verified | `knowledge.service.spec.ts` — CRUD + audit (2 tests) |
| Prompts service | Implemented | `apps/api/src/modules/jessie/prompts.service.ts` |
| ElevenLabs agent-tools | Verified | `elevenlabs-agent-tools.spec.ts` — 5 tests (secret guard, tenant scoping, actor validation) |
| Receptionist identity | Verified | `assistant-prompts.spec.ts` — identity + hold behavior (2 tests) |
| Agent-tools security | Audited | `JESSIE_AGENT_TOOLS_AUDIT.md` — server-side secret, org-scoped, fail-closed |

### Medical Connectors / Integrations
| Integration | Status | Evidence |
|-------------|--------|----------|
| 13-option connector catalog | Implemented | `medical-connectors.service.ts` |
| FHIR CapabilityStatement checks | Verified | Live public endpoints: Epic, Cerner, Veradigm, athenaPractice |
| X12 synthetic coverage | Verified | 270/271, 837P, 837I, 276/277, 278, 835 |
| NPI validation | Verified | Local checksum + live CMS NPPES lookup (PR #32) |
| Ecosystem contracts (18 categories) | Implemented | All categories at IMPLEMENTED-SYNTHETIC minimum |

### External Integration Fallbacks
| Service | When Not Configured | Behavior |
|---------|-------------------|----------|
| OpenAI/LLM | Key unset | HeuristicNoteAssistant + HeuristicChatProvider |
| Stripe | Key unset | ManualPaymentProvider |
| Resend (email) | Key unset | ConsoleEmailProvider |
| Twilio (SMS) | Key unset | ConsoleSmsProvider |

---

## 8. Exact Branches / Commits / PRs

### Current Working Branch
```
Branch: medical-pr28-review-fixes
HEAD:   cfcb389 fix(jessie): wire agent-tools env into local compose
Status: ahead 4, behind 2 of origin
```

### Key Merged PRs
| PR | Commit | Title | Date |
|----|--------|-------|------|
| #16 | `2200e05` | fix(security): finalize SBOS session invalidation and role isolation | 2026-09-05 |
| #20 | `4ecf0e3` | Jessie: secure ElevenLabs hosted agent tools adapter | 2026-09-07 |
| #25 | `08b7288` | Medical: correct capability verification status semantics | 2026-09-10 |
| #27 | `558ff05` | Medical: reconcile connector catalog + X12 coverage | 2026-09-10 |
| #28 | `253c3bc` | Medical: add ecosystem standards contracts | 2026-09-10 |
| #29 | `b3c8c27` | Docs: record live public FHIR capability evidence | 2026-09-10 |
| #32 | `155d93e` | Medical: add live public NPPES verification | 2026-09-10 |

### Open Issues
| Issue | Title | Status |
|-------|-------|--------|
| #26 | P0 Medical one-stop-shop connection completion gate | OPEN — HUMAN_GATE |
| #14 | P1 medical production lane: Railway deploy hardening | OPEN |

### Open PRs
| PR | Title | Branch | Status |
|----|-------|--------|--------|
| #36 | chore: merge fix/jessie-agent-tools-db-profile | fix/jessie-agent-tools-db-profile | OPEN |
| #35 | feat(api): Admissions module | feat/admissions-api-module | OPEN |

---

## 9. Tests / CI / Build Commands and Results

### Test Results (verified 2026-09-21)
```
API:   56 test files, 301 tests — ALL PASS
Core:  26 tests — ALL PASS
Total: 327 tests — 0 failures
```

### Build Results (verified 2026-09-21)
```
Database: prisma generate + tsc — PASS
Core:     tsc — PASS
API:      nest build — PASS
Web:      next build — 22 pages generated, all static/dynamic routes correct
```

### Lint / Typecheck (verified 2026-09-21)
```
API:  tsc --noEmit — PASS
Web:  tsc --noEmit — PASS
```

### Commands to Reproduce
```bash
# Install
pnpm install --frozen-lockfile

# Build all
pnpm --filter @sbos/database build
pnpm --filter @sbos/core build
pnpm --filter @sbos/api build
pnpm --filter @sbos/web build

# Test
pnpm --filter @sbos/api test
pnpm --filter @sbos/core test

# Lint/typecheck
pnpm --filter @sbos/api lint
pnpm --filter @sbos/web lint
```

### CI Status
**No GitHub Actions workflows exist.** The README references CI but no `.github/workflows/` directory is present. All verification is local.

---

## 10. Remaining External / Human Gates

| Gate | Category | Owner | Status |
|------|----------|-------|--------|
| Railway production deployment | Infrastructure | Owner | **BLOCKED** — all services FAILED; `railway.json` deprecated |
| Railway config migration | Infrastructure | Owner | `railway.json` → `.railway/railway.ts` required before 2026-12-01 |
| Epic OAuth client provisioning | Vendor | Owner + Epic | Pending — app ID 60269 needs vendor-side action |
| Oracle Health email verification | Vendor | Owner + Oracle | Expired verification link; fresh flow required |
| MEDITECH Greenfield registration | Vendor | Owner + MEDITECH | External registration/sandbox authorization |
| athenahealth/Veradigm/eClinicalWorks/NextGen/SimplePractice | Vendor | Owner | Registration/tenant authorization/credentials |
| Clearinghouse enrollment (Availity, Change Healthcare) | Vendor | Owner | MFA, contracts/BAAs, endpoint credentials |
| Surescripts/EPCS | Vendor | Owner | Identity proofing, contracts, certification |
| Lab/PACS-RIS/HIE network connections | Vendor | Owner | Production endpoints, credentials, participation agreements |
| Payments (Stripe live) | Vendor | Owner | Merchant/processor selection, contract, credentials |
| Telehealth video vendor | Vendor | Owner | BAA + production meeting credentials |
| HIPAA BAA for database | Compliance | Owner | Railway Postgres BAA status unknown; Supabase alternative documented |
| Production PHI prohibition | Compliance | Owner | PHI prohibited until all legal/compliance/BAA gates satisfied |

---

## 11. Rollback / Recovery

### Application Rollback
```bash
# Revert to previous known-good commit
git revert HEAD

# Or reset to specific commit
git checkout <commit-hash>
```

### Database Migration Rollback
**WARNING:** Prisma migrations are NOT trivially reversible. 13 sequential migrations exist. Rolling back may require manual SQL. The Assessment table (added in migration `20260818230000`) cannot be safely rolled back without data loss.

### Railway Recovery
```bash
# Check current status
railway status

# Redeploy from main
railway up --service sbos-api
railway up --service sbos-web

# Or link and deploy
railway link
railway up
```

### Post-Rollback Smoke Checks
1. `GET /api/v1/health` → `{ status: "ok" }`
2. Login with admin credentials → tokens issued
3. List clients → returns data
4. Create/edit client → persists
5. `GET /api/v1/assessments?clientId=X` → returns data

---

## 12. Next Exact Step

**Fix Railway production deployment.** The immediate blocker is that all Railway services are FAILED/REMOVED. Steps:

1. Run `railway config migrate` to move from deprecated `railway.json` to `.railway/railway.ts`
2. Ensure environment variables are set in Railway dashboard (DATABASE_URL, JWT secrets, AUTH_SECRET, NODE_ENV=production)
3. Re-deploy both `sbos-api` and `sbos-web` from `main` or the production branch
4. Verify health endpoints return HTTP 200
5. Run smoke tests against live Railway URLs

**Secondary:** PR #36 (merge `fix/jessie-agent-tools-db-profile` into main) should be reviewed and merged to align production branch with main.

---

## 13. Safety Boundaries

- **No real PHI** processed or stored in any test environment
- **No paid API calls** made during verification
- **No live payment processing** — ManualPaymentProvider only
- **No fabricated credentials, approvals, or production connectivity claims**
- All `IMPLEMENTED-SYNTHETIC` claims mean code/test coverage only, not vendor authorization
- Production PHI remains prohibited until all applicable legal/compliance/BAA/hosting gates are satisfied

---

*Document generated from verified local test/build evidence and Railway CLI status checks. No claims are fabricated. Live URL verification confirmed Railway production is down.*
