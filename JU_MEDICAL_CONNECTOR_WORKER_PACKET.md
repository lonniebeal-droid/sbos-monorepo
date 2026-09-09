# JU Medical Connector Worker Packet

Follow ju-master-controller + ju-medical-app + ju-project-finisher + ju-handoff rules.

Scope: existing branch claude/sbos-provider-adapter-tests only. One writer. Free model only.
Preserve verified SBOS core and all unrelated behavior. No production deploy, no real PHI, no secrets, no paid APIs.

Release target: office admin can select EHR/PMS, configure/authorize, test connection, discover capabilities, sync permitted synthetic data, see health/errors, retry, reconnect, and revoke without a developer.

Implementation target:
- provider-neutral connector abstraction
- SMART on FHIR/OAuth + FHIR R4 sandbox/mock adapter
- least-privilege scopes
- tenant isolation
- connection status/health model
- audit events for connect/test/sync/retry/revoke
- clear synthetic error states and recovery
- no hard-coded Epic/Cerner credentials
- no vendor approval claims

Acceptance:
1. First create HEARTBEAT_MEDICAL_CONNECTOR.md.
2. Inspect existing architecture/tests before editing.
3. Add smallest safe implementation and focused tests.
4. Run relevant unit/integration tests, typecheck/build where feasible, git diff --check.
5. Write JU_MEDICAL_CONNECTOR_COMPLETION_RECEIPT.md with files, commands, PASS/FAIL counts, branch/SHA, blockers, exact next gate.
6. Do not merge/deploy. Do not alter live DB/EHR/PHI.
