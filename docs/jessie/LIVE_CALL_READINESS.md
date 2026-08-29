# Jessie / ElevenLabs — first live webhook readiness

Status as of branch `docs/jessie-live-call-readiness` (base head of PR #8 implementation).

## Deployment target (discovered)

**No managed platform is configured in-repo.** There is no `railway.json`, `fly.toml`, `vercel.json`, `render.yaml`, or `netlify.toml`.

Primary documented path:

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

## Production database

| Item | Value |
|------|--------|
| Provider expected | **PostgreSQL** (Compose uses `postgres:16-alpine`) |
| `DATABASE_URL` | `postgresql://USER:PASS@HOST:5432/DB?schema=public` |
| Pooling | Not required for first smoke test; use provider pooler URL if your host recommends it (e.g. `?pgbouncer=true` for some managed DBs) |
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
JESSIE_AGENT_SECRETS=<realOrgId>:<openssl rand -base64 32>
```

Format for `JESSIE_AGENT_SECRETS`: `orgId:secret[,orgId2:secret2...]`.  
Multiple secrets per org allowed; duplicate secrets rejected at startup.  
API **refuses to start** in production if JWT secrets are empty/placeholder or if `JESSIE_AGENT_SECRETS` is empty/malformed.

**Not required for first live tool test** (lookup_client / check_calendar):

- `TWILIO_*`, `RESEND_API_KEY`, `EMAIL_FROM` — only for send_sms / send_email  
- `OPENAI_API_KEY` — not used by agent tool webhooks  
- Web `AUTH_SECRET` / `SBOS_API_URL` — only if deploying the web app  

Compose also accepts optional provider keys; offline defaults apply when unset.

## Safest first Jessie tool

**`lookup_client`** — read-only; no SMS/email/appointment side effects.

- Endpoint: `POST https://<public-api-host>/api/v1/jessie/agent/tools/lookup_client`
- Header: `X-SBOS-Agent-Secret: <secret mapped to org>`
- Least data: search by `name` (or `email` / `phone`) that may return zero rows, or `clientId` that is same-org or intentionally unknown (`not_found`).

**Example request body (fake values only):**

```json
{
  "name": "NonexistentTestClient",
  "idempotencyKey": "smoke-lookup-001"
}
```

**Expected response shape (no match):**

```json
{
  "ok": true,
  "tool": "lookup_client",
  "idempotentReplay": false,
  "error": null,
  "message": null,
  "data": {
    "found": false,
    "clients": []
  }
}
```

(Or `ok: false`, `error: "not_found"` when looking up by unknown `clientId`.)

Replay with the same `idempotencyKey` returns the same body with `idempotentReplay: true` and no extra writes.

**`check_calendar`** needs a real same-org `clinicianId` + date — more seed data; use after lookup succeeds.

## Minimum DB records

| Record | Required for lookup_client smoke? |
|--------|-----------------------------------|
| Organization | **Yes** — must match `orgId` in `JESSIE_AGENT_SECRETS` |
| Client | No (empty search is valid); yes if you want a positive match |
| Conversation | No unless you pass `conversationId` / `sessionId` |
| Clinician | Only for `check_calendar` |

**Create test org + client (local/dev only; needs `DATABASE_URL`):**

```bash
# scripts/create_org_and_client.js — prints { orgId, clientId }
# Run against a non-production DB you control:
node scripts/create_org_and_client.js
```

Or seed (opt-in only):

```bash
SBOS_SEED_DEV=true pnpm --filter @sbos/database db:seed
# Creates org slug "success-brand" + admin/clinician users — do NOT use seed credentials in production.
```

Do **not** invent production org IDs. After creating an org, set:

`JESSIE_AGENT_SECRETS=<that-org-id>:<new-secret>`

and restart the API.

## ElevenLabs registration (one tool first)

Source: `docs/jessie/ELEVENLABS_AGENT_TOOLS.md`, `docs/jessie/elevenlabs-webhook-tools.json`.

1. Deploy API so `https://<public-api-host>/api/v1/health` returns `status: ok` and `database.status: up`.
2. Set `JESSIE_AGENT_SECRETS` and restart.
3. In ElevenLabs agent dashboard → Custom / Webhook tools → **Add tool**:
   - **Name:** `lookup_client`
   - **Method:** `POST`
   - **URL:** `https://<public-api-host>/api/v1/jessie/agent/tools/lookup_client`
   - **Header:** `X-SBOS-Agent-Secret` = `<secret>` (never put the secret in git)
   - **Body parameters:** optional `clientId`, `email`, `phone`, `name`, `idempotencyKey`, `conversationId`, `sessionId` (see JSON catalog)
   - **Timeout:** allow ≥ 10–15s (DB + validation; keep under ElevenLabs limits)
4. Test from ElevenLabs or curl first (see smoke plan).
5. After success, register the remaining six tools with the same base URL + header and paths:  
   `save_or_update_lead`, `check_calendar`, `schedule_appointment`, `send_sms`, `send_email`, `transfer_to_human`.

## Live smoke-test sequence

1. **Deploy API** (Compose or your host) with production env (JWT + DB + `JESSIE_AGENT_SECRETS`).
2. **Migrations** — automatic on container start, or `prisma migrate deploy`.
3. **Liveness:** `GET /api/v1/health` → `status` ok/degraded.
4. **Readiness:** same response `database.status === "up"`.
5. Confirm `JESSIE_AGENT_SECRETS` is set (API would not boot in production if empty).
6. Restart/redeploy if secrets were added after first start.
7. **Direct HTTP test (no ElevenLabs):**

```bash
curl -sS -X POST "https://<public-api-host>/api/v1/jessie/agent/tools/lookup_client" \
  -H "Content-Type: application/json" \
  -H "X-SBOS-Agent-Secret: <secret>" \
  -d '{"name":"NonexistentTestClient","idempotencyKey":"smoke-lookup-001"}'
```

8. **Audit:** query `AuditLog` for `entityType = 'JessieAgentTool'` and matching org (pending → completed metadata). Logs should show `POST .../lookup_client 200 ... agentOrg=<orgId>`.
9. Register **one** ElevenLabs tool (`lookup_client`).
10. Invoke from Jessie / agent test call.
11. Confirm `conversationId` correlation if the agent sends it (must be same-org conversation or omitted).
12. Inspect API logs + AuditLog; ensure secret never appears in logs.
13. Register remaining six tools; only then exercise SMS/email/schedule with real providers configured.

**Rollback:** remove or rotate the agent secret (update env + ElevenLabs header); undeploy container; do not delete migrations. Optional: delete test `AuditLog` rows for `JessieAgentTool` in the test org only.

## Observability

| Signal | Status |
|--------|--------|
| Request method/path/status/duration | Yes — `LoggingInterceptor` |
| Agent organization id | Yes — `agentOrg=<id>` when guard resolved secret (no JWT user) |
| Tool name | Visible in path (`.../tools/<tool>`) |
| conversationId | In AuditLog metadata when provided; not forced into HTTP log line |
| Secret redaction | Guard never logs secret; interceptor does not log headers/body |
| Structured tool failures | `AgentToolResult` with `ok`/`error`/`message` |

Do not log `X-SBOS-Agent-Secret`, JWT secrets, API keys, or full PHI payloads.

## Remaining blockers (need your credentials / authorization)

1. **Public HTTPS API host** — none exists in-repo; you must provision and point DNS/TLS.
2. **Production PostgreSQL** — provision and set `DATABASE_URL`.
3. **Real JWT secrets** — generate and set (never commit).
4. **Real organization id** — create org in that DB, then set `JESSIE_AGENT_SECRETS=orgId:secret`.
5. **ElevenLabs account** — agent ID + dashboard access to register webhook tools.
6. **Authorization to deploy** — no platform credentials in-repo; operator must run Compose or push images to a chosen host.

Optional later: Twilio/Resend for SMS/email tools; clinician + availability for calendar/appointments.

## Explicit non-goals for first smoke

- Do not call `send_sms`, `send_email`, or `schedule_appointment` first.
- Do not merge this readiness branch into main without review.
- Do not commit real secrets.
