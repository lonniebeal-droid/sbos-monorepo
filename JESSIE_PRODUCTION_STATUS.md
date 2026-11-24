# Jessie AI Receptionist Production Status

Report date: 2026-09-02
Repo: `/Users/lonniebgroupllc/download/sbos-monorepo`
Branch: `docs/jessie-live-call-readiness`
HEAD: `8eb0ab8bc96424fffdac66c78ff43167450b6901`
Railway project: `SBOS Demo` / `production` / `sbos-api`
Production API: `https://sbos-api-production.up.railway.app`
Latest verified deployment: `66c2595a-bcc8-49ea-8244-1dd0b7d0e832` (`SUCCESS`, created `2026-09-02T01:02:31.700Z`)

## Verified local gates

| Check | Result | Evidence |
| --- | --- | --- |
| Jessie integration tests | PASS | 61/61 passed |
| API typecheck | PASS | `pnpm --filter @sbos/api exec tsc --noEmit` |
| API build | PASS | `pnpm --filter @sbos/api build` |

Focused test files:

- `src/modules/jessie-integration/jessie-integration.controller.spec.ts`
- `src/modules/jessie-integration/jessie-integration.service.spec.ts`
- `src/modules/jessie-integration/jessie-integration.idempotency.spec.ts`
- `src/modules/jessie-integration/jessie-integration.tenant-isolation.spec.ts`
- `src/modules/jessie-integration/guards/elevenlabs-webhook.guard.spec.ts`

## Production auth and route truth

The receptionist surface is the Jessie integration controller, not the legacy patient lookup route.

Base URL:

`https://sbos-api-production.up.railway.app/api/v1/jessie/integration`

Verified live routes:

- `POST /lookup-client`
- `POST /capture-lead`
- `POST /appointment-request`
- `POST /transfer-call`
- `POST /callback-message`
- `POST /call-outcome`
- `POST /business-information`

Verified auth behavior:

- Missing `X-SBOS-Agent-Secret` -> `401 Missing agent credentials`
- Invalid `X-SBOS-Agent-Secret` -> `401 Invalid agent credentials`
- Valid `X-SBOS-Agent-Secret` -> tenant resolved from server-side `JESSIE_AGENT_SECRETS`

Important boundary:

- `POST /api/v1/jessie/agent/tools/lookup_client` is still a patient/client lookup endpoint inside the authenticated tenant.
- It must not be used for inbound business-number resolution.

## Secure tenant binding

Production receptionist tool calls are tenant-bound by the proven `X-SBOS-Agent-Secret` path through `AgentToolsGuard`.

- The controller no longer falls back to `'default'`.
- Tenant identity is taken from `req.agentOrganizationId`.
- Inbound-number lookup is only accepted when the supplied number matches the authenticated organization's stored `Organization.phone`.
- The raw-body `x-elevenlabs-signature` validator remains available for separate signed-webhook use, but it is not the tenant-binding authority for these receptionist routes.

## Verified live tool results

All live calls below were executed against production on `2026-09-02` without exposing secrets in output.

| Tool | Request shape used | Result |
| --- | --- | --- |
| `lookup-client` | `organization_id = org1` | `200` -> returned business profile for `Test Organization` |
| `lookup-client` | `inbound_number = +14046668308` | `404 No active business found for the provided identifier` |
| `business-information` | `clientId = org1` | `200` -> returned business profile for `Test Organization` |
| `capture-lead` | valid caller details + `clientId = org1` | `200` -> `leadId cmtje836p0001ny1abikht4jc`, `status created` |
| `appointment-request` | valid request DTO + `clientId = org1` | `200` -> `appointmentRequestId cmtje8uz60009ny1a8l7xmtzr`, `status requested` |
| `transfer-call` | valid transfer DTO + `clientId = org1` | `200` -> `allowed false`, fallback `callback` |
| `callback-message` | valid callback DTO + `clientId = org1` | `200` -> `messageId cmtje83li0005ny1avzmpvj5t`, `status request_recorded` |
| `call-outcome` | valid outcome DTO + `clientId = org1` | `200` -> `outcomeId cmtje8vcd000dny1aqfac8m83`, `status logged` |

Verified production health after deploy:

- `GET /api/v1/health` -> `200`
- body included `status: "ok"` and `database.status: "up"`

## Exact receptionist contract summary

| Route | Required fields |
| --- | --- |
| `POST /lookup-client` | `identifierType`, `identifierValue` |
| `POST /capture-lead` | `clientId`, `callerName`, `callerPhone`, `reasonForCall`, `conversationId`, `requestId` |
| `POST /appointment-request` | `clientId`, `callerName`, `callerPhone`, `service`, `requestedDate`, `requestedTime`, `timezone`, `conversationId`, `requestId` |
| `POST /transfer-call` | `clientId`, `intent`, `conversationId`, `requestId` |
| `POST /callback-message` | `clientId`, `callerName`, `callerPhone`, `message`, `callbackRequested`, `conversationId`, `requestId` |
| `POST /call-outcome` | `clientId`, `businessName`, `callerName`, `callerPhone`, `intent`, `leadQuality`, `urgency`, `appointmentRequested`, `appointmentCreated`, `transferRequested`, `transferCompleted`, `callbackRequested`, `resolution`, `followUpRequired`, `callSummary`, `conversationId`, `requestId` |
| `POST /business-information` | `clientId` |

## Current blockers

### 1. Inbound business-number lookup is still blocked by production data

Jessie inbound number: `+14046668308`

Verified result:

- `lookup-client` with `identifierType = inbound_number` returned `404`
- the authenticated business profile returned `phone: ""`

This means the current production organization mapped by the active secret does not have the Jessie inbound number stored on `Organization.phone`, so secure same-tenant inbound-number resolution cannot succeed yet.

### 2. Native telephony transfer is not configured

Verified result from `POST /transfer-call`:

- `allowed: false`
- `reason: "No verified telephony transfer destination is configured for this organization"`
- `fallbackBehavior: "callback"`

Do not claim live native handoff or telephony transfer until a real destination is configured and re-tested.

## What is now verified

- Railway production is linked and deployable from this repo.
- The receptionist integration routes are live in production.
- Secure tenant-bound auth via `X-SBOS-Agent-Secret` is working in production.
- Seven Jessie receptionist tool endpoints are mounted and callable in production.
- Lead capture, appointment-request logging, callback/message logging, and call-outcome logging all performed real production writes.
- Conservative business-information responses are live and do not invent booking, transfer, or clinical claims.

## What is not yet verified

- A successful secure inbound-number match for `+14046668308`
- A real ElevenLabs agent calling these routes in production
- A real phone call routed through ElevenLabs into the production API
- A native telephony transfer destination

## Required next operator action

1. Set the correct Jessie business number on the production `Organization.phone` for the organization mapped by the active `JESSIE_AGENT_SECRETS` secret.
2. Re-run `POST /api/v1/jessie/integration/lookup-client` with `identifierType = inbound_number` and `identifierValue = +14046668308`.
3. Only after that succeeds, wire or re-test the ElevenLabs tool configuration against these exact production routes.

## 2026-09-02 completion update

### Done

- Updated the production `Organization` record mapped by the active agent secret: `org1.phone = +14046668308`.
- Re-ran the authenticated production inbound lookup. `POST /api/v1/jessie/integration/lookup-client` with `identifierType: "inbound_number"` and `identifierValue: "+14046668308"` returned `200` and the tenant-bound business profile with `phone: "+14046668308"`.
- Created an ElevenLabs workspace environment variable named `jessie_agent_secret`; its value is not recorded in this repository or these documents.
- Saved the ElevenLabs `lookup_client` tool URL as `https://sbos-api-production.up.railway.app/api/v1/jessie/integration/lookup-client` and configured header `X-SBOS-Agent-Secret` from that workspace environment variable.

### Still not proven

- The final ElevenLabs `lookup_client` body-schema save was interrupted after the URL/header save. It must use `identifierType` and `identifierValue` (with `identifierValue` bound to `system__called_number`) before a platform test can be called valid.
- The other six ElevenLabs tools still show their legacy URLs and have not been converted or tested against the integration API.
- No controlled real inbound call has been completed.
- Native specialist handoff and telephony transfer remain not proven. The verified API behavior is `allowed: false` with callback fallback.
