# ElevenLabs webhook tool contracts (Jessie / SBOS)

Copy these definitions into the ElevenLabs agent dashboard (Custom Tools / Webhooks).

**Base URL:** `https://<your-api-host>/api/v1/jessie/agent/tools`

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
On failure: `ok` is `false`, `error` is a machine-readable code (`not_found`, `invalid_request`, `provider_error`, `schedule_failed`, `no_staff`), `message` is short human text. Secrets never appear in responses.

See `docs/jessie/elevenlabs-webhook-tools.json` for machine-readable definitions of all seven tools.

## Server configuration (operators)

```bash
# Format: orgId:secret[,orgId2:secret2...]
# Multiple secrets per org are allowed. Duplicate secrets are rejected at startup.
export JESSIE_AGENT_SECRETS="org_cuid_here:long-random-secret-here"
```

In production, the API refuses to start if `JESSIE_AGENT_SECRETS` is empty or malformed.
Do not commit real secrets. Rotate by issuing a new secret and updating the ElevenLabs tool headers.

## Idempotency & audit

When `idempotencyKey` is present, the first structured result is stored in `AuditLog`
(`entityType=JessieAgentTool`, `entityId=<tool>:<key>`) with metadata:
`tool`, `conversationId`, `idempotencyKey`, `ok`, `error`, `result`.
Retries return the stored result with `idempotentReplay: true`.
