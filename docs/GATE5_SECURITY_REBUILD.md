# Gate 5 Security Rebuild

## Scope and Baseline

This rebuild was performed only in the isolated `fix/gate5-security-rebuild`
worktree. No deployment, database migration, credential rotation, payment
activation, or external service change was performed.

Baseline commands were run against `fb4459fc19365dbf4a1b69ae21799dc1f082fb2a`:

| Check | Result |
| --- | --- |
| `pnpm lint` | Failed: test-only TypeScript index error in `auth.controller.public-routes.spec.ts` |
| `pnpm test` | Failed: 172/175 passed; two stale peer-role assertions and one bcrypt timeout |
| `pnpm build` | Not run before remediation because the baseline verification suite was already failing |
| `pnpm audit --json` | 2 critical, 30 high, 30 moderate, 7 low |

## Remediated Findings

### Authentication and authorization

- Access-token validation now resolves the current active user record. A
  signed but stale token no longer authorizes a suspended, deactivated, or
  deleted account, and role or organization changes apply immediately.
- User creation derives `organizationId` from the verified authenticated user;
  request bodies cannot select another tenant.
- Privileged user lookup is now organization-scoped, preventing an admin in
  one organization from reading a user record in another organization.
- RBAC regression tests now reflect the explicit hierarchy: functional peer
  roles (`CLINICIAN`, `BILLING`, and `FRONT_DESK`) do not satisfy each other.

### Tenant isolation

- Diagnosis and assessment creation confirm that the client belongs to the
  authenticated organization before creating a record.
- Document upload registration confirms an associated client belongs to the
  authenticated organization before creating an upload target.
- Message-thread creation confirms every participant is an active user in the
  authenticated organization.
- Regression tests cover cross-tenant client references and cross-tenant or
  inactive message participants.

### Dependency remediation

- Upgraded Next.js from `15.1.11` to `15.5.21`, removing the critical
  middleware authorization-bypass finding and related Next.js findings.
- Upgraded Vitest from `2.1.9` to `3.2.6`, removing the critical local Vitest
  UI server finding.
- The upgraded dependency graph also resolves several transitive advisories,
  including the prior esbuild version used by test tooling.

## Secrets, Validation, and Web Controls

- Repository secret scanning found tracked environment example files only; no
  credential values were recorded in this document.
- The API already uses global whitelist/forbid validation, JWT guards, role
  guards, CORS allowlisting, Helmet, safe error responses, HttpOnly cookies,
  and endpoint throttling. These controls were retained.
- Logging continues to avoid request bodies and authentication headers.

## Verification

Run after this change:

```sh
pnpm lint
pnpm --filter @sbos/api exec vitest run --maxWorkers=1
pnpm build
pnpm audit --json
```

The final audit reports `0 critical`, `20 high`, `13 moderate`, and `4 low`.

## Remaining Risks and External Blockers

- The 20 high audit findings are primarily transitive dependencies from Nest
  CLI, Swagger, and the current framework chain. Updating them safely requires
  a separately tested Nest major-version/dependency refresh; no forced upgrade
  was used here.
- Rate limiting is in-memory. Multi-instance production deployment needs a
  shared throttler store before it can be considered horizontally effective.
- This is source and local-test verification, not a production security audit,
  penetration test, hosted deployment verification, HIPAA certification, or
  live database/RLS verification.
- No destructive database action was authorized or performed.
