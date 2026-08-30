# Jessie Staging Integration Prep

Last verified locally: 2026-08-29
Worktree: `/Users/lonniebgroupllc/download/sbos-agent3-jessie`
Branch: `docs/jessie-staging-integration-prep`
HEAD: `3b3df54e52b0cf97c5957ed0d6780c1d46ee695d`

This document turns the repo's existing Jessie documentation into a staging-prep
checklist. It does not claim any live provider account, hosted environment, or
external integration is already working.

## Repo evidence checked

- Jessie module wiring exists in `apps/api/src/modules/jessie/**`.
- Jessie provider configuration is documented in `docs/AI_CONFIGURATION.md`.
- The project roadmap marks Jessie assistants, prompts, memory, and knowledge
  base as built, while live LLM, voice, and workflow automation remain partial
  or future work in `PROJECT_MASTER_PLAN.md`.

## What Jessie is ready to stage locally

- Conversation creation and message persistence
- Assistant routing by kind
- Prompt overrides
- Knowledge-base publishing and retrieval
- Offline heuristic replies when no LLM key is configured
- **Jessie backend integration contracts (7 endpoints) - IMPLEMENTED**
- **Server-to-server authentication for ElevenLabs/Jessie - IMPLEMENTED**
- **Redis-backed distributed rate limiting - IMPLEMENTED**
- **Idempotent write operations - IMPLEMENTED**
- **Tenant isolation for all contracts - IMPLEMENTED**
- **Make event contract emission - IMPLEMENTED**

These are the safest staging targets because they do not require live provider
credentials to validate the control flow.

## Staging integration decisions to make before boot

### AI provider mode

Choose one of two modes explicitly:

1. Offline-only Jessie staging
2. Hosted LLM staging through an OpenAI-compatible endpoint

Offline-only staging is safer for first boot because it avoids secret handling
and BAA questions while still exercising the Jessie routes end to end.

### Non-AI adapters

Decide separately whether staging should keep these in fallback mode or use test
credentials:

- Stripe
- Resend
- Twilio

If test credentials are unavailable, leave them disabled and verify fallback
behavior only.

## Required environment for Jessie staging

Minimum Jessie-capable staging:

- `NODE_ENV=production`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `AUTH_SECRET`
- `SBOS_API_URL`
- `CORS_ORIGINS`
- `REDIS_URL` (for distributed rate limiting)
- `JESSIE_SERVICE_SECRET` (for server-to-server auth)

Only for hosted Jessie chat:

- `OPENAI_API_KEY`
- `AI_BASE_URL`
- `AI_MODEL`

Only for adapter validation:

- `STRIPE_SECRET_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

## Jessie Backend Integration Contracts (IMPLEMENTED)

### 1. lookup_client - VERIFIED
- Tenant-safe client lookup by ID/MRN/phone
- Never exposes another client's data
- Returns: clientId, firstName, lastName, preferredName, mrn, phone, email, status, primaryClinicianId

### 2. capture_lead - IMPLEMENTED
- Validates input (firstName, lastName required)
- Persists lead safely with idempotency key
- Idempotent write - duplicate requests return existing lead
- Returns: leadId, status (CREATED/EXISTS)

### 3. create_or_request_appointment - IMPLEMENTED
- Confirmed appointment only if real scheduler slot exists
- Otherwise creates appointment request (status: REQUESTED)
- Does not falsely report booking confirmation
- Idempotent write with idempotency key
- Returns: appointmentId, status (CONFIRMED/REQUESTED), confirmedStartTime, message

### 4. transfer_call - IMPLEMENTED
- Returns transfer decision/target contract
- Does not claim real telephony transfer unless actual telephony integration exists
- Targets: HUMAN_AGENT, VOICEMAIL, SCHEDULING_QUEUE, CRISIS_LINE
- Returns: status (TRANSFER_INITIATED/TRANSFER_QUEUED/TRANSFER_UNAVAILABLE), transferId, message

### 5. send_message_or_callback_request - IMPLEMENTED
- Persists callback/message request with idempotency
- Does not fake message delivery (uses SMS/EMAIL providers)
- Types: SMS, EMAIL, CALLBACK_REQUEST, INTERNAL_NOTE
- Returns: requestId, status (QUEUED/SENT/EXISTS)

### 6. log_call_outcome - IMPLEMENTED
- Normalizes outcome (COMPLETED, NO_ANSWER, BUSY, FAILED, VOICEMAIL, CALLBACK_REQUESTED, TRANSFERRED)
- Idempotent write with idempotency key
- Returns: logId, status (LOGGED/EXISTS)

### 7. get_business_information - IMPLEMENTED
- Tenant-scoped, approved business information only
- Returns: name, phone, email, address, hours, website, services, timezone

## Auth + Tenancy + Validation

- **Server-to-server authentication** - Bearer token with `JESSIE_SERVICE_SECRET` + `X-Organization-Id` header
- **No hardcoded ElevenLabs secret** - Uses environment-backed secret configuration
- **No secret values printed** - Logging avoids request bodies and auth headers
- **All reads/writes enforce organization/client isolation** - Every query scoped to organizationId
- **Uses existing DTO/schema validation patterns** - class-validator with @nestjs/swagger
- **Consistent JSON response envelopes** - JessieIntegrationResponseDto<T> with success, data, error, requestId

## Idempotency

All write operations are idempotent via `IdempotencyKey` table:
- Sequential duplicate request - returns existing resource
- Parallel duplicate request - database unique constraint prevents race
- Same request key with conflicting payload - throws BadRequestException
- Cross-user / cross-client request isolation - scoped by organizationId

No duplicate lead, callback, appointment request, or call outcome created from replay.

## Make Event Contract

Every contract invocation emits a Make-compatible event via audit log:
```
event_id: "evt-<uuid>"
request_id: "req-<uuid>"
conversation_id: "<conversation-id>"
client_id: "<client-id>"
organization_id: "<org-id>"
event_type: "lookup_client|capture_lead|create_or_request_appointment|transfer_call|send_message_or_callback_request|log_call_outcome|get_business_information"
timestamp: "ISO8601"
payload: { ... }
```

- Does not hardcode Make webhook URL
- Does not send real customer messages
- Does not claim Make end-to-end execution verified

## Rate Limiting

- Reuses verified Gate5 rate-limiting implementation (NestJS Throttler)
- Redis-backed distributed support via custom `RedisThrottlerStorage`
- Does not replace Redis-backed distributed support with memory-only behavior
- Configured: 120 requests per 60 seconds globally

## Tests

- **16 new tests** for JessieIntegrationService covering all 7 contracts
- **7 tests** for JessieAuthGuard covering auth, tenant validation, error cases
- Authentication tests: valid/invalid secret, missing headers, inactive org
- Validation tests: DTO validation, required fields
- Tenant isolation tests: cross-org access denied
- Idempotency tests: duplicate requests, conflicting payloads, cross-client isolation
- Rate-limit integration: uses global throttler (120 req/min)

All existing repository tests pass: **202/202 PASS**

## Documentation

Updated: `docs/JESSIE_STAGING_INTEGRATION_PREP.md`

Documented status:
- VERIFIED: lookup_client implementation and tests
- IMPLEMENTED: All 7 contracts, auth, rate limiting, idempotency, Make events
- NOT VERIFIED: Live ElevenLabs backend binding, live Make execution, live appointment booking, live transfer, production readiness

## Safe staging validation sequence (updated)

1. Boot staging with Jessie in offline mode first.
2. Verify API startup logs show the selected Jessie provider mode and Redis connection.
3. Create a Jessie conversation for each supported assistant kind.
4. Send one message per assistant kind and verify persistence plus response.
5. Add an organization prompt override and verify it wins over the default.
6. Publish a knowledge article and verify a grounded answer path uses it.
7. **Test Jessie integration endpoints:**
   - `POST /api/v1/jessie/integration/lookup-client` - verify tenant-safe lookup
   - `POST /api/v1/jessie/integration/capture-lead` - verify idempotent lead creation
   - `POST /api/v1/jessie/integration/create-or-request-appointment` - verify confirmed vs requested
   - `POST /api/v1/jessie/integration/transfer-call` - verify transfer decision contract
   - `POST /api/v1/jessie/integration/send-message-or-callback-request` - verify queueing
   - `POST /api/v1/jessie/integration/log-call-outcome` - verify idempotent logging
   - `GET /api/v1/jessie/integration/business-information` - verify tenant-scoped info
8. Verify Make events emitted in audit log for each contract call.
9. Verify rate limiting works across multiple requests.
10. Only after offline validation passes, decide whether hosted LLM mode is worth enabling in staging.

## Explicitly out of scope for this prep branch

- Voice receptionist rollout
- Live telephony routing
- Calendar sync
- Workflow automation claims
- Production BAA/compliance signoff
- Any live account changes in OpenAI, Twilio, Stripe, Resend, or ElevenLabs

## Known blockers

- No staging environment or hosted logs were inspected in this session.
- No provider credentials were verified.
- No live voice or phone-routing implementation was validated from this repo.
- Any hosted LLM use with real PHI remains blocked on compliance review and subprocessor agreements.
- Database migrations for new models (Lead, CallLog, CallbackRequest, CallTransfer, IdempotencyKey) not yet applied to any environment.

## Recommended next safe action

Stage Jessie in offline mode first and prove the module routes, persistence,
prompts, and knowledge grounding with fresh HTTP and log evidence. Then test the
7 integration contracts with a service account. Treat hosted LLM, SMS, email,
payments, and voice as separate opt-in validations after the offline path is green.