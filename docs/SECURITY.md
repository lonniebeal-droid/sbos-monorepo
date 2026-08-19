# SBOS — Security

Security posture, controls, and the OWASP Top 10 review for the SBOS platform.
SBOS handles behavioral-health PHI, so it is designed to be **HIPAA-ready** —
technical controls are in place; administrative/physical controls and BAAs are
the operator's responsibility.

## Authentication

- **JWT** access + refresh tokens signed with **separate secrets** (HS256).
  Access tokens are short-lived (15m); refresh tokens last 7 days and carry a
  `type` claim that is verified, so an access token can't be used to refresh.
- Passwords are hashed with **bcrypt** (cost 10); plaintext is never stored or
  logged.
- Login is rate-limited to **5 attempts/minute** per client; the global limit is
  120/minute.
- The API **fails fast** in production if JWT secrets are missing, equal, or left
  at development defaults, or if `DATABASE_URL` is unset.
- **MFA (TOTP)** is supported: enrollment (`/auth/mfa/setup` → QR),
  confirmation (`/auth/mfa/enable`), and a two-step login — a password success
  on an MFA account returns a short-lived challenge that must be completed at
  `/auth/login/mfa` with a 6-digit code. Secrets/codes are generated and
  verified locally (otplib); no third-party MFA service is used.

## Authorization (RBAC)

- Six-role hierarchy enforced by a global `RolesGuard`; higher roles satisfy
  lower requirements. Rules live once in `@sbos/core` (unit-tested).
- **Multi-tenant isolation:** every query is scoped by `organizationId` derived
  from the caller's token — no cross-tenant access is possible through the API.

## Session & cookies (web)

- Session and API tokens are stored in **HttpOnly** cookies, `SameSite=Lax`, and
  `Secure` in production. JavaScript cannot read them (mitigates XSS token
  theft).
- **CSRF:** the API authenticates with `Authorization: Bearer` (not cookies), so
  it is not CSRF-exploitable. The web app's mutations use **Next.js Server
  Actions**, which enforce same-origin POST checks; auth cookies are `SameSite`.

## Input validation

- Global `ValidationPipe` with **whitelist + forbidNonWhitelisted** — unknown
  properties are rejected, and every DTO is validated with class-validator.
- Prisma parameterizes all queries (no string-built SQL) — SQL injection safe.

## Transport & headers

- **Helmet** sets HSTS, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, COOP/CORP, etc.
- TLS terminates at the load balancer; `Secure` cookies require HTTPS in prod.
- **CORS** is restricted to configured origins with credentials enabled.

## Secrets management

- All secrets are read from environment/secret storage only. Nothing sensitive
  is committed; `.env*` files are git-ignored; templates ship `*.example`.
- Provider keys (LLM/Stripe/Resend/Twilio) are never persisted or returned by
  the API.
- **Secrets must never be committed to git or pasted into chat/AI-assistant
  sessions** (including this one) — not in commit messages, code, docs, or
  conversation. Set real values directly in environment/secret storage; use
  a placeholder like `<real-postgres-url>` in any example or instruction.

## Error handling & logging

- A global exception filter returns a **consistent, minimal** error envelope and
  never leaks stack traces or internals to clients; unexpected errors are logged
  server-side with a stack.
- An immutable **audit log** records actor/action/entity for sensitive
  operations (sign, create, delete, payments).

## OWASP Top 10 (2021) review

| # | Risk | Status / control |
| --- | --- | --- |
| A01 | Broken Access Control | Global JWT + RBAC guards; tenant scoping on every query; `@Public()` is explicit |
| A02 | Cryptographic Failures | bcrypt passwords; HS256 JWT w/ separate secrets; TLS + Secure cookies |
| A03 | Injection | Prisma parameterized queries; validated/whitelisted DTOs |
| A04 | Insecure Design | Layered modules, provider abstractions, least-privilege roles, audit trail |
| A05 | Security Misconfiguration | Helmet; fail-fast config validation; non-root containers; CORS allowlist |
| A06 | Vulnerable Components | pnpm lockfile + CI; dependencies pinned; `minimumReleaseAge` policy on installs |
| A07 | Identification & Auth Failures | Short-lived tokens; refresh rotation + reuse detection + revocation; MFA (TOTP); login throttling |
| A08 | Software & Data Integrity | Signed images via CI, additive migrations, immutable note versions/audit log |
| A09 | Logging & Monitoring | Structured logs, audit trail, health/system-health endpoints |
| A10 | SSRF | No user-controlled outbound URLs; provider endpoints are config-fixed |

## Known gaps / roadmap (tracked in RELEASE_1_CHECKLIST.md)

- **MFA (TOTP)** — ✅ implemented (enrollment + two-step login). Recovery codes
  and org-level enforcement policies are the remaining enhancement.
- **Refresh-token rotation/revocation** — ✅ implemented (DB-tracked jti, rotate on refresh, revoke on logout, reuse detection revokes the family).
- **Encryption at rest** for PHI columns and backups — deploy-time control.
- **Dependency scanning / SAST** in CI — planned.
- **Penetration test** before go-live with real PHI.

## Reporting a vulnerability

Email `security@successbrand.org` with details and reproduction steps. Do not
open public issues for security reports.
