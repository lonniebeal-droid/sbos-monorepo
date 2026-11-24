# ElevenLabs webhook tool contracts (Jessie / SBOS)

Copy these definitions into the ElevenLabs agent dashboard (Custom Tools / Webhooks).

**Base URL:** `https://<your-api-host>/api/v1/jessie/agent/tools`

Canonical path (Nest `setGlobalPrefix('api')` + URI version `1` + controller `jessie/agent/tools`).
Example tool URL: `POST https://<your-api-host>/api/v1/jessie/agent/tools/lookup_client`

**Auth (all tools):**
| Header | Value |
|--------|--------|
| `X-SBOS-Agent-Secret` | Per-org secret from server env `JESSIE_AGENT_SECRETS` (never put real secrets in this file) |

**Shared optional parameters (every tool):**
| Name | Type | Description |
|------|------|-------------|
| `idempotencyKey` | string | Optional. Retries with the same key replay the first result without side effects. |
| `conversationId` | string | Optional. Jessie conversation id; must belong to the agent organization. |
| `sessionId` | string | Optional. Alias for `conversationId`. |

**Shared response shape:**
```json
{
  "ok": true,
  "tool": "<tool_name>",
  "idempotentReplay": false,
  "error": null,
  "message": null,
  "data": {}
}
```
On failure: `ok` is `false`, `error` is a machine-readable code (`not_found`, `invalid_request`, `provider_error`, `schedule_failed`, `no_staff`, `idempotency_in_progress`, `idempotency_conflict`), `message` is short human text. Secrets never appear in responses.

See `docs/jessie/elevenlabs-webhook-tools.json` for machine-readable definitions of all seven tools.

## Server configuration (operators)

```bash
# Format: orgId:secret[,orgId2:secret2...]
# Multiple secrets per org are allowed. Duplicate secrets are rejected at startup.
# Use a syntactically valid fake example only — never commit real org IDs or secrets.
export JESSIE_AGENT_SECRETS="org_example_replace_me:secret_example_replace_me"
```

In production, the API refuses to start if `JESSIE_AGENT_SECRETS` is empty or malformed.
Do not commit real secrets. Rotate by issuing a new secret and updating the ElevenLabs tool headers.

## Idempotency & audit

When `idempotencyKey` is present, SBOS uses **claim-before-side-effect** atomicity:

1. `INSERT` an `AuditLog` row with `entityType=JessieAgentTool`, `entityId=<tool>:<key>`,
   `metadata.status=pending` under a **partial unique index** on
   `(organizationId, entityType, entityId)` where `entityType = 'JessieAgentTool'`
   (migration `20260829120000_jessie_agent_tool_idempotency`).
2. On unique conflict: re-read the existing claim. If `completed`/`failed`, replay the
   stored structured result (`idempotentReplay: true`). If still `pending`, return
   `idempotency_in_progress` without executing any business side effect.
3. Only the claim owner runs SMS/email/appointment/lead side effects.
4. After execution, the claim is updated to `status=completed|failed` with the full
   structured result persisted in metadata.

**Retry after a failed provider call:** the failed result is stored and replayed for the
same key. Callers that need a true retry must supply a **new** `idempotencyKey`.

Agent-created appointments record `AuditLog.actorId = null` with metadata
`actorType: jessie_agent`, `tool`, `conversationId`, `idempotencyKey` (no fake User row).

Keys are isolated per organization. Failed tenancy or conversation validation never
executes business side effects.
