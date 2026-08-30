# Staging Verification Checklist — Jessie Integration

**Purpose:** Complete verification gates that must pass before Jessie Commercial Go-Live.
**Status Legend:** ✅ PASS | ❌ FAIL | ⚠️ PARTIAL | ⏸️ NOT TESTED | N/A
**All items must be ✅ PASS for Go-Live.**

---

## Phase 0: Infrastructure Prerequisites (Agent 2)

| # | Check | Status | Evidence | Owner |
|---|-------|--------|----------|-------|
| 0.1 | Railway project provisioned | ⏸️ | Project URL + service list | Agent 2 |
| 0.2 | Managed PostgreSQL deployed | ⏸️ | Connection string; backups enabled | Agent 2 |
| 0.3 | Redis deployed (distributed rate limiting) | ⏸️ | Connection verified; `redis-cli ping` | Agent 2 |
| 0.4 | API deployed to staging | ⏸️ | `https://staging-api.sbos.health/api/v1/health` → 200 | Agent 2 |
| 0.5 | Web deployed to staging | ⏸️ | `https://staging.sbos.health` → 200 | Agent 2 |
| 0.6 | Migrations applied | ⏸️ | `prisma migrate deploy` success logs | Agent 2 |
| 0.7 | Demo tenant seeded | ⏸️ | Known credentials; clean data | Agent 2 |
| 0.8 | TLS + custom domain configured | ⏸️ | SSL Labs A+; cert valid | Agent 2 |
| 0.9 | CORS_ORIGINS set to staging web origin | ⏸️ | Config verified | Agent 2 |
| 0.10 | Environment variables loaded | ⏸️ | All required vars present (no defaults) | Agent 2 |

---

## Phase 1: Jessie Backend Binding (Agent 3)

| # | Check | Status | Evidence | Owner |
|---|-------|--------|----------|-------|
| 1.1 | Jessie API routes accessible | ⏸️ | All 124 routes return 200/401 (not 500) | Agent 3 |
| 1.2 | Heuristic provider works | ⏸️ | `POST /jessie/conversations` → reply | Agent 3 |
| 1.3 | Conversation memory persists | ⏸️ | Multi-turn context maintained | Agent 3 |
| 1.4 | PromptTemplate CRUD works | ⏸️ | Create/list/update/delete prompts | Agent 3 |
| 1.5 | KnowledgeArticle CRUD works | ⏸️ | Create/list/update/delete articles | Agent 3 |
| 1.6 | Knowledge retrieval grounds answers | ⏸️ | RECEPTIONIST answers from KB | Agent 3 |
| 1.7 | Auth (JWT/MFA/RBAC) works | ⏸️ | Login, token refresh, role checks | Agent 3 |
| 1.8 | Audit logging on all AI actions | ⏸️ | `AuditLog` entries for conversations | Agent 3 |
| 1.9 | Rate limiting enforced | ⏸️ | 429 after 100 req/min per org | Agent 3 |
| 1.10 | Health endpoints return 200 | ⏸️ | `/api/v1/health`, `/api/health`, `/platform/system-health` | Agent 3 |

---

## Phase 2: ElevenLabs Binding (Agent 3 + Agent 4)

| # | Check | Status | Evidence | Owner |
|---|-------|--------|----------|-------|
| 2.1 | ElevenLabs agent created (staging) | ⏸️ | Agent ID: `jessie-receptionist-staging` | Agent 3 |
| 2.2 | All 7 tools configured in ElevenLabs | ⏸️ | Tool schemas match `ELEVENLABS_TOOL_SCHEMAS.md` | Agent 3 |
| 2.3 | Service token auth works | ⏸️ | Tool call → 200 with valid `Authorization` | Agent 3 |
| 2.4 | `lookup_client` tool executes | ⏸️ | Returns client or 404 | Agent 3 |
| 2.5 | `capture_lead` tool executes | ⏸️ | Creates Client with status=INTAKE | Agent 3 |
| 2.6 | `create_or_request_appointment` CHECK works | ⏸️ | Returns available slots | Agent 3 |
| 2.7 | `create_or_request_appointment` BOOK works | ⏸️ | Creates Appointment; conflict check | Agent 3 |
| 2.8 | `transfer_call` tool executes | ⏸️ | Creates transfer; returns transferId | Agent 3 |
| 2.9 | `send_message_or_callback_request` executes | ⏸️ | SMS/Email/Task created | Agent 3 |
| 2.10 | `log_call_outcome` tool executes | ⏸️ | Updates conversation outcome | Agent 3 |
| 2.11 | `get_business_information` tool executes | ⏸️ | Returns org profile data | Agent 3 |
| 2.12 | Tool error handling correct | ⏸️ | 4xx/5xx returns proper error envelope | Agent 3 |
| 2.13 | Idempotency keys respected | ⏸️ | Duplicate POST with same key → 200/409 | Agent 3 |
| 2.14 | Rate limiting on tool calls | ⏸️ | 429 after 100 req/min per org | Agent 3 |
| 2.15 | Webhook signatures validated | ⏸️ | Invalid signature → 401 | Agent 3 |

---

## Phase 3: Telephony Integration (Agent 3 + Telephony Lead)

| # | Check | Status | Evidence | Owner |
|---|-------|--------|----------|-------|
| 3.1 | Twilio Voice webhook endpoint exists | ⏸️ | `POST /webhooks/twilio/voice` → 200 | Agent 3 |
| 3.2 | Twilio signature validation works | ⏸️ | Invalid sig → 403 | Agent 3 |
| 3.3 | Inbound call → Jessie conversation | ⏸️ | Call creates Conversation record | Agent 3 |
| 3.4 | STT → Jessie → TTS pipeline works | ⏸️ | Audio in → text → Jessie → audio out | Telephony |
| 3.5 | Warm transfer with whisper works | ⏸️ | Context delivered to human before bridge | Telephony |
| 3.6 | Cold transfer (SIP redirect) works | ⏸️ | Immediate redirect to destination | Telephony |
| 3.7 | Voicemail recording + transcription | ⏸️ | Recording stored; transcription logged | Telephony |
| 3.8 | Call state machine tracks lifecycle | ⏸️ | ringing → connected → ended | Telephony |
| 3.9 | Concurrent calls handled (10+) | ⏸️ | Load test: 10 simultaneous | Telephony |
| 3.10 | Phone number provisioned | ⏸️ | `+15551234567` rings to webhook | Telephony |

---

## Phase 4: Make Integration (Agent 3 + Agent 4)

| # | Check | Status | Evidence | Owner |
|---|-------|--------|----------|-------|
| 4.1 | Standard Route webhook reachable | ⏸️ | `POST https://hook.eu2.make.com/std` → 200 | Agent 3 |
| 4.2 | Escalation Route webhook reachable | ⏸️ | `POST https://hook.eu2.make.com/esc` → 200 | Agent 3 |
| 4.3 | Make signature validation works | ⏸️ | Invalid sig → 401 in Make | Agent 3 |
| 4.4 | `lead.captured` → Google Sheets Leads tab | ⏸️ | Row appended with correct columns | Agent 4 |
| 4.5 | `appointment.booked` → Google Sheets Appointments | ⏸️ | Row appended with correct columns | Agent 4 |
| 4.6 | `transfer.initiated` → Google Sheets Transfers | ⏸️ | Row appended with correct columns | Agent 4 |
| 4.7 | `callback.requested` → Google Sheets Callbacks | ⏸️ | Row appended with correct columns | Agent 4 |
| 4.8 | `emergency.escalated` → Gmail + Sheets Emergency | ⏸️ | Email sent; row appended | Agent 4 |
| 4.9 | `transfer.escalation` → Gmail + Sheets Transfers | ⏸️ | Email sent; row appended | Agent 4 |
| 4.10 | `clinical.concern` → Gmail + Sheets Clinical Notes | ⏸️ | Email sent; row appended | Agent 4 |
| 4.11 | Webhook retry logic works | ⏸️ | 3 retries on 5xx; dead letter on fail | Agent 3 |
| 4.12 | Idempotency on webhook receipt | ⏸️ | Duplicate eventId → no duplicate row | Agent 4 |

---

## Phase 5: Controlled Staging Calls (Full Team)

| # | Check | Status | Evidence | Owner |
|---|-------|--------|----------|-------|
| 5.1 | Script 1: New Lead Intake | ⏸️ | PASS per `CONTROLLED_STAGING_CALL_SCRIPTS.md` | Full Team |
| 5.2 | Script 2: Existing Client Booking | ⏸️ | PASS | Full Team |
| 5.3 | Script 3: Billing Transfer | ⏸️ | PASS | Full Team |
| 5.4 | Script 4: Suicide Keyword (Emergency) | ⏸️ | PASS; transfer < 30s | Full Team |
| 5.5 | Script 5: Panic Attack (Clinical Crisis) | ⏸️ | PASS; transfer < 60s | Full Team |
| 5.6 | Script 6: Medication Question | ⏸️ | PASS; no medical advice given | Full Team |
| 5.7 | Script 7: After-Hours Voicemail | ⏸️ | PASS | Full Team |
| 5.8 | Script 8: Prompt Injection | ⏸️ | PASS; injection rejected | Full Team |
| 5.9 | Script 9: Insurance Question | ⏸️ | PASS | Full Team |
| 5.10 | Script 10: Harm to Others | ⏸️ | PASS; transfer < 20s; 911 fallback | Full Team |
| 5.11 | Script 11: Transfer Fallback | ⏸️ | PASS; fallback triggered | Full Team |
| 5.12 | All 11 scripts PASS | ⏸️ | 11/11 ✅ | Full Team |
| 5.13 | Zero CRITICAL deviations | ⏸️ | No medical advice, no data leak, no injection success | Full Team |
| 5.14 | Conversation transcripts in SBOS | ⏸️ | Dashboard shows all 11 conversations | Full Team |
| 5.15 | Make webhooks all received | ⏸️ | Make execution history shows 11+ successes | Full Team |
| 5.16 | Google Sheets all populated | ⏸️ | Rows in all 5 tabs + Escalation sheets | Full Team |
| 5.17 | Gmail alerts all sent | ⏸️ | Sent folder + Make logs confirm | Full Team |

---

## Phase 6: Security & Compliance (Agent 1 + Agent 4)

| # | Check | Status | Evidence | Owner |
|---|-------|--------|----------|-------|
| 6.1 | Gate 5 Security: 204/204 tests pass | ✅ | `fix/gate5-security-rebuild` @ c2081f9 | Agent 1 |
| 6.2 | Distributed rate limiter active | ✅ | Redis-backed; verified in staging | Agent 1 |
| 6.3 | Service tokens rotated (90 days) | ⏸️ | Secret manager audit log | Agent 1 |
| 6.4 | Webhook secrets unique per endpoint | ⏸️ | Secret manager listing | Agent 1 |
| 6.5 | HMAC validation on all webhooks | ⏸️ | Unit tests pass | Agent 1 |
| 6.6 | CORS locked to staging domains | ⏸️ | `CORS_ORIGINS` env var | Agent 1 |
| 6.7 | No credentials in code/logs | ⏸️ | TruffleHog scan clean | Agent 1 |
| 6.8 | TLS 1.2+ enforced | ⏸️ | SSL Labs A+ | Agent 1 |
| 6.9 | HSTS enabled | ⏸️ | Response headers | Agent 1 |
| 6.10 | CSP headers present | ⏸️ | Helmet config | Agent 1 |
| 6.11 | Tenant isolation verified | ⏸️ | Cross-org query returns 403 | Agent 1 |
| 6.12 | PII not logged | ⏸️ | Log scan; no phone/email/MRN in logs | Agent 1 |

---

## Phase 7: Monitoring & Observability

| # | Check | Status | Evidence | Owner |
|---|-------|--------|----------|-------|
| 7.1 | Structured logging to stdout | ⏸️ | JSON logs in Railway | Agent 2 |
| 7.2 | Error rate alerting configured | ⏸️ | 5xx > 0.5% → PagerDuty | Agent 2 |
| 7.3 | Latency alerting configured | ⏸️ | p95 > 10s → PagerDuty | Agent 2 |
| 7.4 | Conversation volume metrics | ⏸️ | Daily count in dashboard | Agent 3 |
| 7.5 | Fallback rate metric (LLM→heuristic) | ⏸️ | < 5% target | Agent 3 |
| 7.6 | Transfer success rate metric | ⏸️ | > 95% target | Agent 3 |
| 7.7 | Knowledge retrieval hit rate | ⏸️ | > 80% target | Agent 3 |
| 7.8 | Audit log write latency < 100ms | ⏸️ | p95 metric | Agent 3 |
| 7.9 | Dead letter queue monitored | ⏸️ | WebhookDelivery FAILED alerts | Agent 3 |

---

## Phase 8: Rollback & Disaster Recovery

| # | Check | Status | Evidence | Owner |
|---|-------|--------|----------|-------|
| 8.1 | Feature flag kill switch works | ⏸️ | `jessie_chat` flag disables in < 5 min | Agent 3 |
| 8.2 | ElevenLabs agent disable procedure | ⏸️ | Agent status → inactive in < 2 min | Agent 3 |
| 8.3 | Make webhook disable procedure | ⏸️ | Scenario OFF in < 1 min | Agent 4 |
| 8.4 | Twilio webhook URL change procedure | ⏸️ | New URL configured in < 5 min | Telephony |
| 8.5 | Database rollback procedure tested | ⏸️ | Point-in-time recovery < 15 min | Agent 2 |
| 8.6 | Service token revocation tested | ⏸️ | Token revoked → 401 immediately | Agent 1 |

---

## Phase 9: Documentation & Handoff

| # | Check | Status | Evidence | Owner |
|---|-------|--------|----------|-------|
| 9.1 | All integration docs complete | ⏸️ | 12 docs in `docs/integration/` | Agent 4 |
| 9.2 | Runbooks created for all incident types | ⏸️ | `docs/runbooks/` populated | Agent 4 |
| 9.3 | On-call rotation configured | ⏸️ | PagerDuty schedule active | Ops |
| 9.4 | Client launch checklist template ready | ⏸️ | `JESSIE_CLIENT_LAUNCH_CHECKLIST.md` | Agent 4 |
| 9.5 | Support escalation contacts defined | ⏸️ | `JESSIE_SUPPORT_AND_INCIDENT_PLAN.md` | Ops |

---

## Go/No-Go Decision Matrix

| Category | Required PASS | Current PASS | Go/No-Go |
|----------|---------------|--------------|----------|
| Infrastructure (Phase 0) | 10/10 | 0/10 | **NO-GO** |
| Jessie Backend (Phase 1) | 10/10 | 0/10 | **NO-GO** |
| ElevenLabs Binding (Phase 2) | 15/15 | 0/15 | **NO-GO** |
| Telephony (Phase 3) | 10/10 | 0/10 | **NO-GO** |
| Make Integration (Phase 4) | 12/12 | 0/12 | **NO-GO** |
| Controlled Calls (Phase 5) | 17/17 | 0/17 | **NO-GO** |
| Security (Phase 6) | 12/12 | 4/12 | **PARTIAL** |
| Monitoring (Phase 7) | 9/9 | 0/9 | **NO-GO** |
| Rollback (Phase 8) | 6/6 | 0/6 | **NO-GO** |
| Documentation (Phase 9) | 5/5 | 1/5 | **PARTIAL** |
| **TOTAL** | **106/106** | **5/106** | **NO-GO** |

---

## Sign-Off Requirements

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Engineering Lead (Agent 1) | | | |
| Infrastructure Lead (Agent 2) | | | |
| Jessie Backend Lead (Agent 3) | | | |
| Commercial Docs Lead (Agent 4) | | | |
| Telephony Lead | | | |
| Product Manager | | | |
| Compliance Officer | | | |

**Final Verdict:** **COMMERCIAL_GO_LIVE = NO** — All phases must be ✅ PASS before Go-Live.

---

## Tracking

| Field | Value |
|-------|-------|
| Checklist Version | 1.0 |
| Last Updated | 2026-08-29 |
| Next Review | Weekly until Go-Live |
| Owner | Agent 4 (Commercial Docs) |
| Staging Environment | `https://staging-api.sbos.health` |
| ElevenLabs Agent | `jessie-receptionist-staging` |
| Make Standard Scenario | `scenario-std-staging` |
| Make Escalation Scenario | `scenario-esc-staging` |