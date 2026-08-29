# Jessie / ElevenLabs — first live webhook readiness

Status: branch `docs/jessie-live-call-readiness` (extends PR #8 Jessie agent-tools head).
**Merge after PR #8.** Do not deploy from this branch until an operator provisions a host.

## Deployment target (discovered)

**No managed platform is configured in-repo.** There is no `railway.json`, `fly.toml`, `vercel.json`, `render.yaml`, or `netlify.toml`.

| Path | Status |
|------|--------|
| **Docker Compose** (`docker-compose.yml` + `apps/api/Dockerfile`) | Fully specified; API runs Prisma `migrate deploy` on container start |
| Managed (Railway / Fly / AWS ECS) | Documented as Option B in `docs/DEPLOYMENT.md` only; images build in CI |

**Public production API:** none discovered. No hardcoded production host. You must provide a publicly reachable HTTPS host for ElevenLabs webhooks.

**Exact deploy (Compose, single host):**

```bash
cp .env.production.example .env
# Fill REQUIRED secrets (see Environment section). Never commit .env.
docker compose up --build -d
docker compose ps
docker compose logs -f api
```

**Exact deploy (image build for a managed host you control):**

```bash
docker build -f apps/api/Dockerfile -t <registry>/sbos-api:<tag> .
# Push to your registry; set env vars on the platform; expose HTTPS on the API service.
```

API listens on `PORT` (default **4000**). Global prefix `api`, URI version `1`.

Canonical placeholders (never invent a real host in docs):

- Health: `https://<public-api-host>/api/v1/health`
- First tool: `https://<public-api-host>/api/v1/jessie/agent/tools/lookup_client`

## Docker startup chain (proven from Dockerfile)

From `apps/api/Dockerfile` runner stage:

```text
CMD ["sh", "-c",
  "packages/database/node_modules/.bin/prisma migrate deploy --schema=packages/database/prisma/schema.prisma
   && node apps/api/dist/main.js"]
```

| Step | Behavior |
|------|----------|
| Container start | Shell runs migrate, then Nest |
| Migration failure | `&&` short-circuits; Nest **does not start**; container exits non-zero |
| Database unavailable | `migrate deploy` fails → same as above |
| Nest crash after successful migrate | Process exits; orchestrator restarts per policy; schema already applied |
| HEALTHCHECK | `GET /api/v1/health` every 30s (start period 40s); fails if fetch non-OK or network error |

The application does **not** pretend to be up after a failed migration.

## Production database

| Item | Value |
|------|--------|
| Provider expected | **PostgreSQL** (Compose uses `postgres:16-alpine`) |
| `DATABASE_URL` | `postgresql://USER:PASS@HOST:5432/DB?schema=public` |
| Production DB exists? | **Unknown** — no cloud project is wired in-repo |

**Safe production migration command** (idempotent; also runs automatically on API container start):

```bash
# From repo root with DATABASE_URL set:
pnpm --filter @sbos/database prisma:deploy

# Or inside the API container:
packages/database/node_modules/.bin/prisma migrate deploy --schema=packages/database/prisma/schema.prisma
```

Required migration for agent tools:

`20260829120000_jessie_agent_tool_idempotency`  
(partial unique index on `AuditLog` for `entityType = 'JessieAgentTool'`).

Do **not** run `prisma migrate reset` or destructive commands against production.

## Environment variables (production)

Minimum for API boot + first Jessie tool call:

```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://USER:PASS@HOST:5432/sbos?schema=public
JWT_ACCESS_SECRET=<openssl rand -base64 48>
JWT_REFRESH_SECRET=<openssl rand -base64 48>   # must differ from access
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
CORS_ORIGINS=https://app.yourdomain.com
# Syntactically valid shape only — replace with real org id + secret at deploy time:
# JESSIE_AGENT_SECRETS="org_example_replace_me:secret_example_replace_me"
JESSIE_AGENT_SECRETS=<realOrgId>:<openssl rand -base64 32>
```

Format for `JESSIE_AGENT_SECRETS`: `orgId:secret[,orgId2:secret2...]`.  
Multiple secrets per org allowed; duplicate secrets rejected at startup.  
API **refuses to start** in production if JWT secrets are empty/placeholder or if `JESSIE_AGENT_SECRETS` is empty/malformed.

Templates: `.env.production.example`, `.env.docker.example`, `apps/api/.env.example`, and Compose pass-through for `JESSIE_AGENT_SECRETS`.

**Not required for first live tool test** (`lookup_client`):

- `TWILIO_*`, `RESEND_API_KEY`, `EMAIL_FROM` — only for send_sms / send_email  
- `OPENAI_API_KEY` — not used by agent tool webhooks  
- Web `AUTH_SECRET` / `SBOS_API_URL` — only if deploying the web app  

## Health endpoint (actual behavior)

| Item | Value |
|------|--------|
| Route | `GET /api/v1/health` (`@Public()`, version `1`, path `health`) |
| Auth | None |
| HTTP status | **Always 200** when the process is up and the handler runs (even if DB is down) |
| Body when healthy | `status: "ok"`, `database.status: "up"`, optional `latencyMs`, `timestamp`, `uptime` |
| Body when DB fails | `status: "degraded"`, `database.status: "down"`, `latencyMs: null` |
| Secrets | None exposed |

This is a **combined** liveness + DB readiness signal in one JSON body, **not** separate Kubernetes-style liveness/readiness endpoints.
Docker HEALTHCHECK treats any successful HTTP response as healthy; operators should also inspect `database.status` for true readiness.

## Safest first Jessie tool

**`lookup_client`** — read-only; no SMS/email/appointment side effects.

- Endpoint: `POST https://<public-api-host>/api/v1/jessie/agent/tools/lookup_client`
- Header: `X-SBOS-Agent-Secret: <secret mapped to org>`
- Auth: org resolved **only** from server-side `JESSIE_AGENT_SECRETS` map (never from body)

**Example request body (fake values only):**

```json
{
  "name": "NonexistentTestClient",
  "idempotencyKey": "smoke-lookup-001"
}
```

**Expected response (name search, zero rows) — verified from `AgentToolsService.lookupClient`:**

```json
{
  "ok": true,
  "tool": "lookup_client",
  "data": {
    "found": false,
    "clients": []
  }
}
```

Notes from implementation:

- `idempotentReplay` is set **only on replay** (`true`); first execution omits it.
- `error` / `message` appear only when `ok` is false.
- Unknown `clientId` → `{ "ok": false, "tool": "lookup_client", "error": "not_found", "message": "Client not found in this organization" }`.
- Missing all of clientId/email/phone/name → `error: "invalid_request"`.

### Expected auth / context matrix

| Case | HTTP | Body summary |
|------|------|----------------|
| No `X-SBOS-Agent-Secret` | 401 | Nest unauthorized (`Missing agent credentials`) |
| Invalid secret | 401 | Nest unauthorized (`Invalid agent credentials`) |
| Valid secret + name with no match | 200 | `ok: true`, `found: false`, `clients: []` |
| Valid secret + unknown clientId | 200 | `ok: false`, `error: "not_found"` |
| Same idempotencyKey replay | 200 | Prior result + `idempotentReplay: true` |
| Foreign / unknown conversationId | 200 | `ok: false` (conversation not in org) |
| Valid same-org conversationId | 200 | Proceeds; conversation id stored in AuditLog metadata |

All tool routes return **HTTP 200** with structured `AgentToolResult` on business failures; auth failures are **401**.

Replay with the same `idempotencyKey` returns the prior body with `idempotentReplay: true` and no extra side effects.

**`check_calendar`** needs a real same-org `clinicianId` + date — more seed data; use after lookup succeeds.

## Minimum DB records

| Record | Required for lookup_client smoke? |
|--------|-----------------------------------|
| Organization | **Yes** — must match `orgId` in `JESSIE_AGENT_SECRETS` |
| Client | No (empty search is valid); yes if you want a positive match |
| Conversation | No unless you pass `conversationId` / `sessionId` |
| Clinician | Only for `check_calendar` |

### Organization bootstrap (production-safe finding)

| Mechanism | Safe for production? | Notes |
|-----------|----------------------|--------|
| `scripts/create_org_and_client.js` | **No** | Dev helper; uses ambient `DATABASE_URL` / Prisma client; creates `test-org-*` rows with fixed demo client names; no env guard against production |
| `SBOS_SEED_DEV=true` database seed | **No** | Explicitly gated; creates demo org + known passwords — never use seed credentials in production |
| Existing org already in the DB | **Yes** | Prefer selecting a real org created via normal product/admin flows |
| Authenticated Organizations API | **Yes (preferred)** | Create/select org through the secured API with a real operator account after deploy |

**Blocker if no org exists yet:** there is no production-hardened bootstrap CLI in-repo. An operator must create an organization through the normal authenticated path (or a controlled one-off SQL/admin procedure outside this readiness branch), then set `JESSIE_AGENT_SECRETS=<that-org-id>:<new-secret>` and restart the API.

Do **not** point `create_org_and_client.js` at a production database.

## ElevenLabs registration (one tool first)

Source of truth: `docs/jessie/ELEVENLABS_AGENT_TOOLS.md`, `docs/jessie/elevenlabs-webhook-tools.json`.

1. Deploy API so `https://<public-api-host>/api/v1/health` returns body `status: "ok"` and `database.status: "up"`.
2. Set `JESSIE_AGENT_SECRETS` and restart.
3. In ElevenLabs agent dashboard → Custom / Webhook tools → **Add tool**:
   - **Name:** `lookup_client`
   - **Method:** `POST`
   - **URL:** `https://<public-api-host>/api/v1/jessie/agent/tools/lookup_client`
   - **Header:** `X-SBOS-Agent-Secret` = `<secret>` (never put the secret in git)
   - **Body parameters:** optional `clientId`, `email`, `phone`, `name`, `idempotencyKey`, `conversationId`, `sessionId`
   - **Timeout:** allow ≥ 10–15s
4. Test with curl first (see smoke plan), then from ElevenLabs.
5. After success, register the remaining six tools with the same base URL + header:

| Tool | Path |
|------|------|
| `lookup_client` | `/api/v1/jessie/agent/tools/lookup_client` |
| `save_or_update_lead` | `/api/v1/jessie/agent/tools/save_or_update_lead` |
| `check_calendar` | `/api/v1/jessie/agent/tools/check_calendar` |
| `schedule_appointment` | `/api/v1/jessie/agent/tools/schedule_appointment` |
| `send_sms` | `/api/v1/jessie/agent/tools/send_sms` |
| `send_email` | `/api/v1/jessie/agent/tools/send_email` |
| `transfer_to_human` | `/api/v1/jessie/agent/tools/transfer_to_human` |

## Live smoke-test sequence

1. **Deploy API** (Compose or your host) with production env (JWT + DB + `JESSIE_AGENT_SECRETS`).
2. **Migrations** — automatic on container start (`migrate deploy && node …`), or run `prisma migrate deploy` out-of-band.
3. **Health:** `GET https://<public-api-host>/api/v1/health` → inspect JSON (`status` + `database.status`).
4. Confirm `JESSIE_AGENT_SECRETS` is set (API would not boot in production if empty).
5. Restart/redeploy if secrets were added after first start.
6. **Direct HTTP test (no ElevenLabs):**

```bash
curl -sS -X POST "https://<public-api-host>/api/v1/jessie/agent/tools/lookup_client" \
  -H "Content-Type: application/json" \
  -H "X-SBOS-Agent-Secret: <generated-agent-secret>" \
  -d '{"name":"NonexistentTestClient","idempotencyKey":"smoke-lookup-001"}'
```

7. **Audit:** query `AuditLog` for `entityType = 'JessieAgentTool'` and matching org. Logs should show `POST .../lookup_client 200 ... agentOrg=<orgId>` (never the secret).
8. Register **one** ElevenLabs tool (`lookup_client`).
9. Invoke from Jessie / agent test call.
10. Confirm `conversationId` correlation if the agent sends it (must be same-org conversation or omitted).
11. Inspect API logs + AuditLog; ensure secret never appears in logs.
12. Register remaining six tools; only then exercise SMS/email/schedule with real providers configured.

**Rollback:** remove or rotate the agent secret (update env + ElevenLabs header); stop the container; do not delete migrations. Optional: delete test `AuditLog` rows for `JessieAgentTool` in the test org only.

## Observability

| Signal | Status |
|--------|--------|
| Request method/path/status/duration | Yes — `LoggingInterceptor` |
| Agent organization id | Yes — `agentOrg=<id>` only when `AgentToolsGuard` resolved the secret and set `req.agentOrganizationId` |
| Tool name | Visible in path (`.../tools/<tool>`) |
| conversationId | In AuditLog metadata when provided; not forced into HTTP log line |
| Secret redaction | Guard never logs secret; interceptor logs only method, URL, status, duration, user/org or agentOrg — never headers, bodies, JWT, API keys, or DB URLs |
| Structured tool failures | `AgentToolResult` with `ok` / `error` / `message` |

`agentOrganizationId` is **not** read from the request body or from a client-supplied header other than the validated secret mapping. An attacker cannot inject an arbitrary org id into the log line without possessing a valid agent secret.

## Remaining blockers (need operator credentials / authorization)

1. **Public HTTPS API host** — none exists in-repo; provision DNS/TLS.
2. **Production PostgreSQL** — provision and set `DATABASE_URL`.
3. **Real JWT secrets** — generate and set (never commit).
4. **Real organization id** — create via secured product path (not the dev script), then set `JESSIE_AGENT_SECRETS=orgId:secret`.
5. **ElevenLabs account** — agent ID + dashboard access to register webhook tools.
6. **Authorization to deploy** — no platform credentials in-repo.

Optional later: Twilio/Resend for SMS/email tools; clinician + availability for calendar/appointments.

## Explicit non-goals for first smoke

- Do not call `send_sms`, `send_email`, or `schedule_appointment` first.
- Do not merge this readiness branch before PR #8.
- Do not commit real secrets.
- Do not point dev seed/bootstrap scripts at production.
