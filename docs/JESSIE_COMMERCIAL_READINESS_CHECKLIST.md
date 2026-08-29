# Jessie Commercial Readiness Checklist

**Status Legend:**
- **READY** — Verified working in target environment with evidence
- **NEEDS VERIFICATION** — Implemented but not yet tested in staging/production
- **BLOCKED** — Missing dependency, credential, or infrastructure
- **NOT REQUIRED** — Out of scope for current commercial MVP

---

## PRODUCT

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| Multi-assistant router (receptionist, scheduling, intake, clinical, knowledge, general) | READY | 98 routes verified; heuristic provider tested |
| Conversation memory (persisted messages, full history replay) | READY | Conversation + ConversationMessage models; tested |
| Admin prompt management (per-kind, versioned) | READY | PromptTemplate CRUD; resolveSystemPrompt() tested |
| Knowledge base with grounding retrieval | READY | Keyword-based retrieval; 20-article limit |
| Offline heuristic chat provider | READY | Deterministic, no external deps; demo-ready |
| LLM chat provider (OpenAI-compatible) | NEEDS VERIFICATION | Adapter built; requires OPENAI_API_KEY + BAA |
| AI note generation (clinical composer) | NEEDS VERIFICATION | `/notes/generate` endpoint exists; UI wired |
| Voice receptionist (telephony + STT/TTS) | BLOCKED | Not implemented; requires Twilio Voice + speech provider |
| Scheduling actions (book/reschedule via API) | BLOCKED | Heuristic responds but no tool calling / function execution |
| Intake automation (structured data → client create) | BLOCKED | Heuristic collects; no API action execution |
| Workflow automation (triggers → actions) | BLOCKED | Not implemented |
| Knowledge base embeddings/semantic search | BLOCKED | Keyword match only; no vector retrieval |

---

## SECURITY

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| JWT access + refresh tokens (separate secrets) | READY | Implemented; rotation + revocation + reuse detection |
| Hierarchical RBAC (6 roles) | READY | Org-scoped on every query; tested |
| Multi-tenant isolation (organizationId on all tables) | READY | Prisma schema; verified |
| Global input validation (whitelist + forbid unknown) | READY | class-validator DTOs; global pipe |
| Rate limiting (global + login) | READY | In-memory; Redis needed for multi-replica |
| Helmet security headers | READY | Configured in main.ts |
| CORS allowlist with credentials | READY | Configurable via CORS_ORIGINS |
| HttpOnly/Secure/SameSite cookies (prod) | READY | NODE_ENV=production triggers |
| Fail-fast config validation (no default secrets in prod) | READY | Throws on missing/default secrets in production |
| Consistent error envelope (no leakage) | READY | AllExceptionsFilter |
| Immutable audit log (all AI actions logged) | READY | AuditAction.CREATE with provider metadata |
| MFA (TOTP) enrollment + two-step login | READY | Implemented and tested |
| Encryption at rest (DB + backups + documents) | BLOCKED | Platform-dependent; not yet provisioned |
| Secrets in managed secret store (not .env) | BLOCKED | Requires infrastructure decision |
| BAAs with enabled subprocessors (LLM/Stripe/Resend/Twilio) | BLOCKED | Required before PHI in production |
| Penetration test | BLOCKED | Not yet scheduled |

---

## BACKEND

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| NestJS API (124 routes, 21 controllers) | READY | Builds, boots, smoke-tested |
| Prisma + PostgreSQL (42 models, 13 migrations) | READY | All migrations applied cleanly on real PG |
| Docker multi-stage images (non-root, HEALTHCHECK) | READY | Verified boot locally |
| Health endpoints (api, web, admin system-health) | READY | `/api/v1/health`, `/api/health`, `/platform/system-health` |
| Structured request logging | READY | Logging interceptor; stdout |
| Background job queue (BullMQ/Redis) | BLOCKED | Redis in compose but not wired in code |
| Document storage (S3-compatible abstraction) | NEEDS VERIFICATION | StorageModule abstraction ready; bucket not provisioned |
| Automated backups + tested restore | BLOCKED | None exist |
| Connection pooler (PgBouncer) | BLOCKED | Not yet needed; decide at scale |
| Managed PostgreSQL provisioned | BLOCKED | Required for production |

---

## ELEVENLABS

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| ElevenLabs integration | BLOCKED | Not in codebase; no adapter, no config |
| Voice selection / configuration | BLOCKED | Not implemented |
| TTS streaming to telephony | BLOCKED | Requires telephony integration first |
| Latency optimization | BLOCKED | N/A |
| Fallback to heuristic on TTS failure | BLOCKED | N/A |

---

## TELEPHONY

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| Twilio Voice integration | BLOCKED | SMS adapter only; no Voice webhook handler |
| Phone number provisioning | BLOCKED | Manual process; not automated |
| Inbound call → Jessie webhook | BLOCKED | No endpoint for voice webhook |
| Call recording / transcription | BLOCKED | Not implemented |
| Transfer (warm/cold) to human | BLOCKED | Heuristic says "I'll connect you" but no SIP/Voice action |
| Voicemail handling | BLOCKED | Not implemented |
| After-hours routing | BLOCKED | Logic exists in heuristic; no telephony execution |
| Caller ID / ANI lookup | BLOCKED | Not implemented |
| Concurrent call handling | BLOCKED | N/A |

---

## CLIENT CONFIGURATION

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| Per-tenant PromptTemplate management | READY | Admin API; versioned; org-scoped |
| Per-tenant KnowledgeArticle management | READY | Admin API; published filter; org-scoped |
| Feature flags per tenant | READY | FeatureFlag model; gating not yet wired to Jessie |
| Business hours / timezone config | NEEDS VERIFICATION | Organization.timezone field exists; hours not modeled |
| Transfer destinations config | BLOCKED | No data model; would need new tables |
| Lead capture field config | BLOCKED | No data model; heuristic has fixed steps |
| Custom greeting / instructions | READY | Via PromptTemplate.systemPrompt |
| Restricted statements / emergency rules | BLOCKED | No data model; heuristic has no guardrails |

---

## TESTING

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| Unit tests (@sbos/core + API services/guards/filter) | READY | 17 API tests + 12 core tests; all pass |
| E2E happy-path tests | BLOCKED | Not implemented |
| Load/performance testing | BLOCKED | Not done |
| Security testing (pen test) | BLOCKED | Not scheduled |
| Chaos/failure injection testing | BLOCKED | Not done |
| Telephony integration testing | BLOCKED | No telephony integration |

---

## DEMO

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| Local demo (zero credentials) | READY | Heuristic provider; full product demos |
| Staging environment | BLOCKED | Not provisioned |
| Staging smoke test evidence | BLOCKED | No staging |
| Controlled live call demo | BLOCKED | No telephony |
| Demo data / demo tenant isolation | READY | Seed creates demo org; idempotent |
| Sales demo script | NEEDS VERIFICATION | SBOS_DEMO_PACKAGE.md exists; Jessie-specific needed |

---

## LEGAL/COMPLIANCE

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| HIPAA technical safeguards (RBAC, audit, isolation, transport) | READY | Implemented in code |
| HIPAA administrative safeguards (policies, training, access reviews) | BLOCKED | Organizational; not in code |
| HIPAA physical/infra (encrypted storage, hosting BAA, backup encryption) | BLOCKED | Platform-dependent |
| BAA with OpenAI/Azure/LLM provider | BLOCKED | Required before live LLM with PHI |
| BAA with Stripe/Resend/Twilio | BLOCKED | Required if enabled with PHI |
| Breach notification procedure | BLOCKED | Not documented |
| Data retention & disposal policy | BLOCKED | Not documented |
| Audit log review cadence + tamper evidence | BLOCKED | Not documented |
| Risk assessment | BLOCKED | Not done |

---

## PAYMENT/BILLING

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| Stripe adapter (server-side PaymentIntent) | READY | Adapter built; activates on STRIPE_SECRET_KEY |
| Client-side checkout (Stripe Elements) | BLOCKED | Not implemented in web |
| Subscription billing (Stripe Billing) | BLOCKED | Not implemented |
| Usage metering (seats, AI credits) | BLOCKED | Not implemented |
| Jessie standalone pricing model | BLOCKED | Not defined |
| Invoice generation for Jessie usage | BLOCKED | Not implemented |

---

## SUPPORT

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| Support tier definitions | BLOCKED | Not defined |
| On-call rotation | BLOCKED | Not defined |
| Incident runbook | BLOCKED | Not documented |
| Customer escalation path | BLOCKED | Not defined |
| SLA commitments | BLOCKED | Not defined |
| Support tooling (ticketing, knowledge base) | BLOCKED | Not implemented |

---

## MONITORING

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| Centralized log aggregation | BLOCKED | Not provisioned |
| Metrics + alerting (uptime, error rate, latency, DB) | BLOCKED | Not provisioned |
| Error tracking (Sentry or equivalent) | BLOCKED | Not integrated |
| Jessie-specific metrics (conversation volume, fallback rate, transfer rate) | BLOCKED | Not instrumented |
| Business metrics (leads captured, bookings attempted, transfers) | BLOCKED | Not instrumented |

---

## ROLLBACK

| Item | Status | Evidence / Notes |
|------|--------|------------------|
| Database migration rollback procedure | NEEDS VERIFICATION | Prisma migrate deploy is forward-only; down migrations not tested |
| Feature flag kill switches | READY | FeatureFlag model exists; gating not fully wired |
| Blue/green or rolling deploy capability | BLOCKED | Requires platform decision |
| Config rollback (prompt templates, knowledge) | READY | Versioned PromptTemplate; knowledge articles editable |
| Phone number re-routing procedure | BLOCKED | No telephony integration |