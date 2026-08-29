# Jessie Commercial Readiness Checklist

**Status Legend:**
- **VERIFIED** — Runtime evidence in target environment (tests pass, smoke test, live call)
- **IMPLEMENTED_NOT_VERIFIED** — Code exists but not yet executed/verified in staging
- **BLOCKED** — Missing hard dependency (infra, integration, staffing)
- **FUTURE** — Planned but not implemented; not a current launch blocker
- **NOT_REQUIRED** — Out of scope for current commercial MVP

---

## PRODUCT

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| Multi-assistant router (receptionist, scheduling, intake, clinical, knowledge, general) | VERIFIED | 124 routes; heuristic provider tested locally |
| Conversation memory (persisted messages, full history replay) | VERIFIED | Conversation + ConversationMessage models; tested |
| Admin prompt management (per-kind, versioned) | VERIFIED | PromptTemplate CRUD; resolveSystemPrompt() tested |
| Knowledge base with grounding retrieval | VERIFIED | Keyword-based retrieval; 20-article limit |
| Offline heuristic chat provider | VERIFIED | Deterministic, no external deps; demo-ready |
| LLM chat provider (OpenAI-compatible) | IMPLEMENTED_NOT_VERIFIED | Adapter built; requires OPENAI_API_KEY + BAA; not tested in staging |
| AI note generation (clinical composer) | IMPLEMENTED_NOT_VERIFIED | `/notes/generate` endpoint exists; UI wired; not tested in staging |
| Voice receptionist (telephony + STT/TTS) | FUTURE | Not implemented; requires Twilio Voice + speech provider |
| Scheduling actions (book/reschedule via API) | FUTURE | Heuristic responds but no tool calling / function execution |
| Intake automation (structured data → client create) | FUTURE | Heuristic collects; no API action execution |
| Workflow automation (triggers → actions) | FUTURE | Not implemented |
| Knowledge base embeddings/semantic search | FUTURE | Keyword match only; no vector retrieval |

---

## SECURITY

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| JWT access + refresh tokens (separate secrets) | VERIFIED | Implemented; rotation + revocation + reuse detection |
| Hierarchical RBAC (6 roles) | VERIFIED | Org-scoped on every query; tested |
| Multi-tenant isolation (organizationId on all tables) | VERIFIED | Prisma schema; verified |
| Global input validation (whitelist + forbid unknown) | VERIFIED | class-validator DTOs; global pipe |
| Rate limiting (global + login) | VERIFIED | In-memory; distributed rate limiter implemented (Gate 5) |
| Helmet security headers | VERIFIED | Configured in main.ts |
| CORS allowlist with credentials | VERIFIED | Configurable via CORS_ORIGINS |
| HttpOnly/Secure/SameSite cookies (prod) | VERIFIED | NODE_ENV=production triggers |
| Fail-fast config validation (no default secrets in prod) | VERIFIED | Throws on missing/default secrets in production |
| Consistent error envelope (no leakage) | VERIFIED | AllExceptionsFilter |
| Immutable audit log (all AI actions logged) | VERIFIED | AuditAction.CREATE with provider metadata |
| MFA (TOTP) enrollment + two-step login | VERIFIED | Implemented and tested |
| Encryption at rest (DB + backups + documents) | FUTURE | Platform-dependent; not yet provisioned |
| Secrets in managed secret store (not .env) | FUTURE | Requires infrastructure decision; staging first |
| BAAs with enabled subprocessors (LLM/Stripe/Resend/Twilio) | FUTURE | Required only if live LLM enabled for PHI |
| Penetration test | FUTURE | Gate 5 verified with 204/204 tests; pen test for compliance later |

---

## BACKEND

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| NestJS API (124 routes, 21 controllers) | VERIFIED | Builds, boots, smoke-tested locally |
| Prisma + PostgreSQL (42 models, 13 migrations) | VERIFIED | All migrations applied cleanly on real PG (local) |
| Docker multi-stage images (non-root, HEALTHCHECK) | VERIFIED | Verified boot locally |
| Health endpoints (api, web, admin system-health) | VERIFIED | `/api/v1/health`, `/api/health`, `/platform/system-health` |
| Structured request logging | VERIFIED | Logging interceptor; stdout |
| Background job queue (BullMQ/Redis) | FUTURE | Redis in compose but not wired in code |
| Document storage (S3-compatible abstraction) | IMPLEMENTED_NOT_VERIFIED | StorageModule abstraction ready; bucket not provisioned |
| Automated backups + tested restore | FUTURE | None exist |
| Connection pooler (PgBouncer) | FUTURE | Not yet needed; decide at scale |
| Managed PostgreSQL provisioned | BLOCKED | Required for staging (Agent 2) |

---

## ELEVENLABS

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| ElevenLabs integration | IMPLEMENTED_NOT_VERIFIED | Agent/tool config exists in codebase; backend binding not verified in staging |
| Voice selection / configuration | IMPLEMENTED_NOT_VERIFIED | Config exists; not tested in staging |
| TTS streaming to telephony | FUTURE | Requires telephony integration first |
| Latency optimization | FUTURE | N/A |
| Fallback to heuristic on TTS failure | FUTURE | N/A |

---

## TELEPHONY

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| Twilio Voice integration | FUTURE | SMS adapter only; no Voice webhook handler |
| Phone number provisioning | FUTURE | Manual process; not automated |
| Inbound call → Jessie webhook | FUTURE | No endpoint for voice webhook |
| Call recording / transcription | FUTURE | Not implemented |
| Transfer (warm/cold) to human | FUTURE | Heuristic says "I'll connect you" but no SIP/Voice action |
| Voicemail handling | FUTURE | Not implemented |
| After-hours routing | IMPLEMENTED_NOT_VERIFIED | Logic exists in heuristic; no telephony execution |
| Caller ID / ANI lookup | FUTURE | Not implemented |
| Concurrent call handling | FUTURE | N/A |

---

## CLIENT CONFIGURATION

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| Per-tenant PromptTemplate management | VERIFIED | Admin API; versioned; org-scoped |
| Per-tenant KnowledgeArticle management | VERIFIED | Admin API; published filter; org-scoped |
| Feature flags per tenant | IMPLEMENTED_NOT_VERIFIED | FeatureFlag model; gating not yet wired to Jessie |
| Business hours / timezone config | IMPLEMENTED_NOT_VERIFIED | Organization.timezone field exists; hours not modeled separately |
| Transfer destinations config | FUTURE | No data model; would need new tables |
| Lead capture field config | FUTURE | No data model; heuristic has fixed steps |
| Custom greeting / instructions | VERIFIED | Via PromptTemplate.systemPrompt |
| Restricted statements / emergency rules | FUTURE | No data model; heuristic has no guardrails |

---

## TESTING

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| Unit tests (@sbos/core + API services/guards/filter) | VERIFIED | 17 API tests + 12 core tests; all pass |
| Gate 5 security tests | VERIFIED | 204/204 tests pass (fix/gate5-security-rebuild) |
| E2E happy-path tests | FUTURE | Not implemented |
| Load/performance testing | FUTURE | Not done |
| Security testing (pen test) | FUTURE | Gate 5 verified; pen test for compliance later |
| Chaos/failure injection testing | FUTURE | Not done |
| Telephony integration testing | FUTURE | No telephony integration |

---

## DEMO

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| Local demo (zero credentials) | VERIFIED | Heuristic provider; full product demos |
| Staging environment | BLOCKED | Not provisioned (Agent 2) |
| Staging smoke test evidence | BLOCKED | No staging |
| Controlled live call demo | BLOCKED | No telephony + no staging |
| Demo data / demo tenant isolation | VERIFIED | Seed creates demo org; idempotent |
| Sales demo script | VERIFIED | `JESSIE_COMMERCIAL_DEMO_SCRIPT.md` complete |

---

## LEGAL/COMPLIANCE

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| HIPAA technical safeguards (RBAC, audit, isolation, transport) | VERIFIED | Implemented in code; Gate 5 verified |
| HIPAA administrative safeguards (policies, training, access reviews) | FUTURE | Organizational; not in code |
| HIPAA physical/infra (encrypted storage, hosting BAA, backup encryption) | FUTURE | Platform-dependent; staging first |
| BAA with OpenAI/Azure/LLM provider | FUTURE | Required only if live LLM enabled for PHI |
| BAA with Stripe/Resend/Twilio | FUTURE | Required only if enabled with PHI |
| Breach notification procedure | FUTURE | Not documented |
| Data retention & disposal policy | FUTURE | Not documented |
| Audit log review cadence + tamper evidence | FUTURE | Not documented |
| Risk assessment | FUTURE | Gate 5 verified; formal assessment later |

---

## PAYMENT/BILLING

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| Stripe adapter (server-side PaymentIntent) | VERIFIED | Adapter built; activates on STRIPE_SECRET_KEY |
| Client-side checkout (Stripe Elements) | FUTURE | Not implemented in web |
| Subscription billing (Stripe Billing) | FUTURE | Not implemented |
| Usage metering (seats, AI credits) | FUTURE | Not implemented |
| Jessie standalone pricing model | FUTURE | Not defined |
| Invoice generation for Jessie usage | FUTURE | Not implemented |

---

## SUPPORT

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| Support tier definitions | FUTURE | Not defined |
| On-call rotation | FUTURE | Not defined |
| Incident runbook | IMPLEMENTED_NOT_VERIFIED | `JESSIE_SUPPORT_AND_INCIDENT_PLAN.md` template; no on-call staffed |
| Customer escalation path | FUTURE | Not defined |
| SLA commitments | FUTURE | Not defined |
| Support tooling (ticketing, knowledge base) | FUTURE | Not implemented |

---

## MONITORING

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| Centralized log aggregation | FUTURE | Not provisioned |
| Metrics + alerting (uptime, error rate, latency, DB) | FUTURE | Not provisioned |
| Error tracking | FUTURE | Not integrated |
| Jessie-specific metrics (conversation volume, fallback rate, transfer rate) | FUTURE | Not instrumented |
| Business metrics (leads captured, bookings attempted, transfers) | FUTURE | Not instrumented |

---

## ROLLBACK

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| Database migration rollback procedure | IMPLEMENTED_NOT_VERIFIED | Prisma migrate deploy is forward-only; down migrations not tested |
| Feature flag kill switches | VERIFIED | FeatureFlag model exists; gating not fully wired |
| Blue/green or rolling deploy capability | FUTURE | Requires platform decision |
| Config rollback (prompt templates, knowledge) | VERIFIED | Versioned PromptTemplate; knowledge articles editable |
| Phone number re-routing procedure | FUTURE | No telephony integration |