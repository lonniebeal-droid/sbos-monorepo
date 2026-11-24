# JU Medical Suite Connector — Completion Receipt

- **Date:** 2026-10-12
- **Branch:** `claude/sbos-provider-adapter-tests` (new, from `main` @ d1eaf4f)
- **Writer:** one-writer subagent. No merge, no deploy, no live DB/EHR/PHI touched.
- **Packet:** `JU_MEDICAL_CONNECTOR_WORKER_PACKET.md` (all 6 acceptance steps followed)

## What was implemented

**New: provider-neutral connector adapter** — `apps/api/src/integrations/provider/provider-adapter.ts`
(`ProviderAdapter` wrapping any `VendorConnectorBase`, incl. the SMART on FHIR R4
sandbox/mock `SmartOAuthService`):

- Least-privilege SMART scopes (`SMART_SCOPES`: patient/Patient.read,
  patient/Appointment.read, patient/Observation.read, offline_access); each
  operation declares minimum required scopes and is rejected when ungranted.
- Tenant isolation: every operation (`connect/test/sync/retry/revoke`) is bound
  to the adapter's tenantId; cross-tenant calls are rejected.
- Connection health model: `disconnected → connected → degraded → error`
  via `getHealth()` (token presence, error count, synthetic error state).
- Audit events for CONNECT / TEST / SYNC / RETRY / REVOKE, recorded with
  `organizationId = tenantId`, provider, and `synthetic: true` (no PHI).
- Synthetic error states + recovery: `simulateError('expired_token' |
  'rate_limited' | 'network')`; `retry()` refreshes an expired token and
  clears rate-limit backoff (recoverable), refuses on network failure;
  `revoke()` clears error state. No real network, no hard-coded vendor creds.

**Tests:** `apps/api/src/integrations/provider/__tests__/provider-adapter.spec.ts`
(7 tests: lifecycle+audit, tenant isolation, scope enforcement, health
transitions, expired-token recovery, rate-limit block/recover, revoke clears
error). Existing `VendorConnectorBase`, `SmartOAuthService`, admin service,
and all vendor/clearinghouse connectors untouched.

**Heartbeat:** `HEARTBEAT_MEDICAL_CONNECTOR.md` (created first, per packet).

## Verification

| Check | Result |
|---|---|
| New spec (`provider-adapter.spec.ts`) | **7 passed / 0 failed** |
| Full `src/integrations` suite (15 files) | **62 passed / 0 failed** |
| `tsc --noEmit` | 549 errors before AND after (all pre-existing `@sbos/database` / `@sbos/core` workspace resolution issues); **0 errors in new files** |
| `git diff --check` | clean (new files only, no whitespace issues) |

Commands run:
- `pnpm install --frozen-lockfile`
- `node ../../node_modules/.pnpm/vitest@3.2.6_.../node_modules/vitest/vitest.mjs run src/integrations/provider/__tests__/provider-adapter.spec.ts`
- `node .../vitest.mjs run src/integrations`
- `node ../../node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc --noEmit`

## Files changed (new, untracked → committed on branch)

- `HEARTBEAT_MEDICAL_CONNECTOR.md`
- `apps/api/src/integrations/provider/provider-adapter.ts`
- `apps/api/src/integrations/provider/__tests__/provider-adapter.spec.ts`
- `JU_MEDICAL_CONNECTOR_COMPLETION_RECEIPT.md` (this file)

## Blockers

None blocking. Notes:
- `pnpm vitest` prompted for confirmation and hung; worked around by invoking
  the workspace vitest binary directly.
- `tsc --noEmit` has 549 pre-existing errors from unresolved `@sbos/*`
  workspace packages (identical count on clean `main`); none from this work.
- A mid-task `git stash` round-trip briefly conflicted
  `docs/HIPAA_TECHNICAL_READINESS.md`; restored to `HEAD` — the other branch's
  stashed work (`stash@{0}`, `fix/issue-14-backup-ci-audit`) is untouched.

## Exact next gate

Human review of this branch, then (separately): wire `ProviderAdapter` into
`IntegrationAdminService.connectSmartOnFhir` (or a new admin endpoint) behind
the existing tenant registry, plus a UI surface for office-admin
configure → authorize → test → sync → retry/revoke. Do NOT merge until the
pre-existing `tsc` workspace-resolution failures are addressed on `main`.

---

## Phase 2 — Admin wiring (2026-10-12, same branch)

**What was implemented** (per phase-2 task; next gate from phase-1 receipt):

`apps/api/src/integrations/admin/integration-admin.service.ts` (extended):
- Per-tenant `ProviderAdapter` registry (`adapters: Map<tenantId, ProviderAdapter>`)
  alongside the existing connector tenant registry.
- Full office-admin lifecycle, every op tenant-bound through the adapter:
  `configureMedicalProvider` (select EHR/PMS + scopes, registers connector +
  adapter, not yet authorized) → `authorizeMedicalConnection` (OAuth code
  exchange) → `testMedicalConnection` → `getMedicalConnectionHealth` →
  `getMedicalConnectionCapabilities` (provider, granted scopes, supported
  resources, health) → `syncMedicalResources` → `retryMedicalConnection` →
  `revokeMedicalConnection` (adapter revoke + registry removal).
- Provider selection: `smart-fhir` (SMART on FHIR R4) + 8 vendor connectors.
  Unknown providers and duplicate tenant registrations rejected.
- Tenant isolation: adapter re-asserts tenantId on every operation; the
  service never trusts a caller-supplied tenant for another tenant's adapter.

`apps/api/src/integrations/admin/integration-admin.controller.ts` (new):
- ORG_ADMIN-only endpoints at `/v1/integrations/admin/medical-providers`
  (`POST` configure, `POST /authorize`, `POST /test`, `GET /health`,
  `GET /capabilities`, `POST /sync`, `POST /retry`, `DELETE` revoke).
- Tenant is derived from `@CurrentUser() user.organizationId` on every
  endpoint — never accepted from the request body.

`apps/api/src/integrations/admin/integration-admin.module.ts` (new) +
`apps/api/src/app.module.ts` (2-line additive registration).

**Tests:** `apps/api/src/integrations/__tests__/integration-admin-wiring.spec.ts`
(6 tests: full lifecycle, duplicate rejection, unknown provider, tenant
isolation, vendor connector lifecycle, scope enforcement).

**Verification:**

| Check | Result |
|---|---|
| New wiring spec | **6 passed / 0 failed** |
| Full `src/integrations` suite (16 files) | **68 passed / 0 failed** (was 62; no regressions) |
| `tsc --noEmit` | **549 errors** — identical to pre-existing baseline on `main`; **0 in new/changed files** (2 transient strict-null errors in the new spec were fixed) |
| `git diff --check` | clean |

**Files changed (phase 2):**
- `apps/api/src/integrations/admin/integration-admin.service.ts` (extended)
- `apps/api/src/integrations/admin/integration-admin.controller.ts` (new)
- `apps/api/src/integrations/admin/integration-admin.module.ts` (new)
- `apps/api/src/integrations/__tests__/integration-admin-wiring.spec.ts` (new)
- `apps/api/src/app.module.ts` (2-line additive module registration)
- `HEARTBEAT_MEDICAL_CONNECTOR.md` (phase-2 entry)

**Commit:** `fdb4230` on `claude/sbos-provider-adapter-tests`. Not merged, not deployed. No PHI, no secrets, no paid APIs. $0.

## Exact next gate

Human review of the branch (`claude/sbos-provider-adapter-tests` @ `fdb4230`).
After review: office-admin UI surface (configure → authorize → test → sync →
retry/revoke) calling the new `/v1/integrations/admin/medical-providers`
endpoints. Do NOT merge until the pre-existing `tsc` workspace-resolution
failures on `main` are addressed.
