# Jessie Implementation Handoff

**Audience:** Engineering (Agent 1, 2, 3 + core team)
**Purpose:** Define exactly what must be true before commercial launch
**Source of Truth:** This document + `JESSIE_COMMERCIAL_STATUS_MATRIX.md` + `JESSIE_COMMERCIAL_READINESS_CHECKLIST.md`

---

## Reference Map

| Area | Agent | Key Artifacts |
|------|-------|---------------|
| Security | Agent 1 | `docs/SECURITY.md`, `RELEASE_1_CHECKLIST.md` §2 |
| Railway Staging | Agent 2 | `docs/DEPLOYMENT.md`, Railway project |
| Jessie Backend Integration | Agent 3 | `apps/api/src/modules/jessie/`, `apps/api/src/ai/` |
| ElevenLabs Config | — | Not yet started |
| Telephony | — | Twilio Voice not integrated |
| Controlled Live Call | — | Requires all above |
| Monitoring | — | Not provisioned |

---

## Release Gates

### GATE A — SECURITY (Agent 1)
**Must be ✅ before any PHI in production**

| Requirement | Status | Evidence Needed |
|-------------|--------|-----------------|
| Penetration test completed | ⬜ | Report + remediation |
| BAAs executed with all enabled subprocessors | ⬜ | Signed BAAs (OpenAI, Stripe, Resend, Twilio) |
| Encryption at rest (DB, backups, documents) | ⬜ | Platform config + verification |
| Secrets in managed secret store | ⬜ | No `.env` in prod; secret manager configured |
| MFA enforced for all workforce accounts | ✅ | TOTP implemented |
| Audit log tamper-evidence + export | ⬜ | Design doc + test |
| Risk assessment completed | ⬜ | Documented |

**Owner:** Agent 1 / Security Lead
**Blocker for:** GATE H

---

### GATE B — STAGING (Agent 2)
**Must be ✅ before GATE F/G/H**

| Requirement | Status | Evidence Needed |
|-------------|--------|-----------------|
| Railway project provisioned | ⬜ | Project URL + service list |
| Managed PostgreSQL deployed | ⬜ | Connection string; backups enabled |
| Redis deployed (for rate limiting) | ⬜ | Connection verified |
| API + Web deployed to staging | ⬜ | `https://staging-api.sbos.health`, `https://staging.sbos.health` |
| Health checks passing | ⬜ | `/health` 200 on both |
| Migrations applied | ⬜ | `prisma migrate deploy` success |
| Demo tenant seeded (clean, no PHI) | ⬜ | Known credentials |
| CORS_ORIGINS set to staging web origin | ⬜ | Config verified |
| TLS + custom domain configured | ⬜ | Cert valid |

**Owner:** Agent 2 / Infra Lead
**Blocker for:** GATE F, GATE G, GATE H

---

### GATE C — BACKEND TOOLS (Agent 3)
**Must be ✅ for commercial MVP (booking, intake, transfer actions)**

| Requirement | Status | Evidence Needed |
|-------------|--------|-----------------|
| Tool calling framework implemented | ⬜ | `ChatProvider` supports function calling |
| `schedule_appointment` tool implemented | ⬜ | Calls `POST /appointments`; returns slot/confirmation |
| `create_client_from_intake` tool implemented | ⬜ | Calls `POST /clients`; returns client ID |
| `transfer_call` tool implemented | ⬜ | Returns TwiML `<Dial>` or webhook trigger |
| `request_callback` tool implemented | ⬜ | Sends notification (email/SMS); logs in conversation |
| Heuristic provider updated to use tools | ⬜ | Falls back to simulated response if no LLM |
| LLM provider updated to use tools | ⬜ | Function calling with OpenAI/Claude |
| Tool execution audit logged | ⬜ | `AuditLog` with tool name, args, result |

**Owner:** Agent 3 / Backend Lead
**Blocker for:** GATE F, GATE H

---

### GATE D — ELEVENLABS / VOICE (TBD)
**Required for voice receptionist MVP**

| Requirement | Status | Evidence Needed |
|-------------|--------|-----------------|
| TTS provider selected (ElevenLabs / Deepgram / Twilio) | ⬜ | Decision doc |
| TTS adapter implemented (`SPEECH_PROVIDER` abstraction) | ⬜ | Interface + implementation |
| Voice selection configurable per org | ⬜ | `Organization.voice_id` or feature flag |
| Streaming TTS to Twilio `<Say>` or Media Streams | ⬜ | Latency < 500ms first byte |
| Fallback to heuristic text if TTS fails | ⬜ | Graceful degradation |
| SSML support for prosody control | ⬜ | Optional but recommended |

**Owner:** Voice Lead (new)
**Blocker for:** GATE E, GATE F

---

### GATE E — PHONE / TELEPHONY (TBD)
**Required for any voice offering**

| Requirement | Status | Evidence Needed |
|-------------|--------|-----------------|
| Twilio Voice webhook endpoint implemented | ⬜ | `POST /webhooks/twilio/voice` |
| TwiML response for inbound call → Jessie | ⬜ | `<Connect>` to Media Stream or `<Say>` + `<Gather>` |
| STT integration (Deepgram / Twilio / Whisper) | ⬜ | Audio → text → Jessie chat → TTS → audio |
| Call state machine (ringing → connected → ended) | ⬜ | Tracks in `Conversation` or new `Call` model |
| Warm transfer via `<Dial>` with context | ⬜ | Transfers to extension/number with whisper |
| Voicemail recording + transcription | ⬜ | Stores in `Document` or `ConversationMessage` |
| Phone number provisioning API / docs | ⬜ | Manual process documented |
| Concurrent call handling tested | ⬜ | Load test: 10+ simultaneous |

**Owner:** Telephony Lead (new)
**Blocker for:** GATE F, GATE H

---

### GATE F — CONTROLLED LIVE CALL
**Must be ✅ before GATE G, GATE H**

| Requirement | Status | Evidence Needed |
|-------------|--------|-----------------|
| Staging environment live (GATE B) | ⬜ | URL accessible |
| Telephony integrated (GATE E) | ⬜ | Twilio number → staging webhook |
| Voice working (GATE D) | ⬜ | TTS + STT functional |
| Backend tools working (GATE C) | ⬜ | Booking, intake, transfer execute |
| 10 successful end-to-end test calls | ⬜ | Call logs + conversation records |
| 3 test calls with injection/edge cases | ⬜ | Guardrails hold |
| Fallback behavior verified (LLM down → heuristic) | ⬜ | Circuit breaker tested |
| Latency measured (p95 < 3s end-to-end) | ⬜ | Metrics captured |
| Recording + audit trail complete | ⬜ | `ConversationMessage` + `AuditLog` |

**Owner:** Full Team (integration test)
**Blocker for:** GATE G, GATE H

---

### GATE G — COMMERCIAL DEMO
**Must be ✅ before external demos**

| Requirement | Status | Evidence Needed |
|-------------|--------|-----------------|
| Staging environment stable | ⬜ | 99.9% uptime over 1 week |
| Demo script rehearsed (`JESSIE_COMMERCIAL_DEMO_SCRIPT.md`) | ⬜ | Recording or live run-through |
| Demo tenant isolated from other clients | ⬜ | Separate org; clean data |
| All demo flows work on heuristic (zero creds) | ✅ | Verified locally |
| Live LLM demo path documented (if enabled) | ⬜ | "With key" vs "without key" |
| Sales team trained on approved claims | ⬜ | `JESSIE_APPROVED_SALES_CLAIMS.md` review |

**Owner:** PM + Sales Engineering
**Blocker for:** External selling

---

### GATE H — CLIENT LAUNCH
**Must be ✅ per client before go-live**

| Requirement | Status | Evidence Needed |
|-------------|--------|-----------------|
| All GATE A–G ✅ | ⬜ | Gate sign-offs |
| Client onboarding complete (`JESSIE_CLIENT_ONBOARDING_TEMPLATE.md`) | ⬜ | Signed |
| Client launch checklist complete (`JESSIE_CLIENT_LAUNCH_CHECKLIST.md`) | ⬜ | All items checked |
| Phone number ported + pointed to Jessie | ⬜ | Live inbound test call |
| Monitoring alerts configured for client | ⬜ | Error rate, latency, volume |
| Support runbooks accessible | ⬜ | On-call has access |
| Client signoff recorded | ⬜ | Written/email approval |
| Rollback plan tested (feature flag disable) | ⬜ | < 5 min to disable |

**Owner:** Implementation Lead + Client Success
**Gate Review:** Weekly until all clients launched

---

## Cross-Agent Dependencies

```
GATE A (Security) ──────────────────────┐
                                        │
GATE B (Staging) ───────────────────────┼──→ GATE F (Controlled Call)
                                        │         │
GATE C (Backend Tools) ─────────────────┤         │
                                        │         ▼
GATE D (Voice/TTS) ─────────────────────┼──→ GATE E (Telephony)
                                        │         │
                                        ▼         ▼
                                  GATE G (Commercial Demo)
                                        │
                                        ▼
                                  GATE H (Client Launch)
```

---

## Engineering Tasks by Gate

### For GATE A (Security) — Agent 1
- [ ] Schedule pen test; track remediation
- [ ] Execute BAAs with OpenAI, Stripe, Resend, Twilio
- [ ] Configure encryption at rest on managed PG + S3
- [ ] Migrate secrets to secret manager (1Password/Infisical/AWS Secrets Manager)
- [ ] Implement audit log export + tamper evidence (hash chain)

### For GATE B (Staging) — Agent 2
- [ ] Provision Railway project (or chosen platform)
- [ ] Deploy managed PostgreSQL (Railway PG / RDS / Cloud SQL)
- [ ] Deploy Redis (for distributed rate limiting)
- [ ] Configure CI/CD to deploy `staging` branch to Railway
- [ ] Run `prisma migrate deploy` + seed
- [ ] Verify health endpoints, CORS, TLS
- [ ] Document staging access for team

### For GATE C (Backend Tools) — Agent 3
- [ ] Design `Tool` interface + `ToolProvider` abstraction
- [ ] Implement `schedule_appointment` tool (calls AppointmentsService)
- [ ] Implement `create_client_from_intake` tool (calls ClientsService)
- [ ] Implement `transfer_call` tool (returns TwiML or triggers webhook)
- [ ] Implement `request_callback` tool (sends notification)
- [ ] Update `HeuristicChatProvider` to simulate tool results
- [ ] Update `LlmChatProvider` for OpenAI function calling
- [ ] Add tool execution to `AuditLog`

### For GATE D (Voice) — New Owner
- [ ] Evaluate ElevenLabs vs Deepgram vs Twilio TTS
- [ ] Implement `SpeechProvider` abstraction (STT + TTS)
- [ ] Build adapters for selected provider(s)
- [ ] Add voice config to `Organization` or `FeatureFlag`
- [ ] Implement streaming TTS for low latency

### For GATE E (Telephony) — New Owner
- [ ] Build Twilio Voice webhook handler (`/webhooks/twilio/voice`)
- [ ] Implement call state machine (new `Call` model or extend `Conversation`)
- [ ] Integrate STT → Jessie chat → TTS pipeline
- [ ] Build warm transfer with `<Dial>` + context whisper
- [ ] Implement voicemail recording + transcription
- [ ] Document phone number provisioning process
- [ ] Load test concurrent calls

### For GATE F (Controlled Call) — Full Team
- [ ] Run integration test suite against staging
- [ ] Execute 10+ happy-path live calls
- [ ] Execute 3+ adversarial calls (injection, emergency, off-topic)
- [ ] Measure and document latency
- [ ] Verify audit trail completeness
- [ ] Sign off gate

---

## Definition of Done per Gate

| Gate | DoD |
|------|-----|
| A | Security lead signs; pen test report clean; BAAs in hand; secrets off disk |
| B | Staging URL works; DB seeded; health checks green; team can access |
| C | All 4 tools implemented + tested; heuristic + LLM both execute; audit logged |
| D | TTS adapter works; voice configurable; latency < 500ms; fallback tested |
| E | Inbound call → Jessie → response audio works; transfer works; voicemail works |
| F | 10 clean calls recorded; latency measured; guardrails verified; team sign-off |
| G | Sales can run demo script on staging without engineering help |
| H | Client checklist 100%; phone live; monitoring on; client signed; rollback tested |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Tool calling framework takes longer than estimated | High | High | Start GATE C now; parallelize with GATE B |
| ElevenLabs latency / cost unacceptable | Medium | High | Evaluate 3 providers; have fallback (Twilio TTS) |
| Twilio Voice integration complexity | High | High | Spike first; consider Media Streams vs `<Gather>` |
| Staging environment delays (Railway limits) | Medium | Medium | Have backup platform (Fly.io, Render) |
| BAAs take longer than expected | Medium | High | Start BAA conversations now; parallel track |
| No dedicated voice/telephony engineer | High | High | Hire or contract; this is a specialized skill set |
| Client launch blocked on phone porting | Medium | Medium | Start porting 4 weeks before target launch |

---

## Sign-Off Requirements

| Gate | Required Signatures |
|------|---------------------|
| A | Security Lead + Legal + CTO |
| B | Infra Lead + Engineering Manager |
| C | Backend Lead + Agent 3 + QA |
| D | Voice Lead + Backend Lead |
| E | Telephony Lead + Backend Lead |
| F | All Gate owners + PM |
| G | PM + Sales Lead + Engineering Manager |
| H | Implementation Lead + Client Success + Client (written) |

---

## Next Actions (This Week)

1. **Agent 1:** Start pen test scheduling; initiate BAA conversations
2. **Agent 2:** Provision Railway staging; deploy DB + Redis
3. **Agent 3:** Begin tool calling framework design (spike 2 days)
4. **PM:** Assign Voice/Telephony owners; start provider evaluation
5. **All:** Review this doc; propose changes by Friday EOD