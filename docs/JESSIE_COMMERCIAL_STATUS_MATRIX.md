# Jessie Commercial Status Matrix

**Source of truth for commercial readiness. Updated per release.**
**Status values: VERIFIED | IMPLEMENTED_NOT_VERIFIED | IN_PROGRESS | BLOCKED | FUTURE**
**Evidence = repo path, test result, doc, or "N/A" — only VERIFIED items have runtime evidence**

---

| COMPONENT | STATUS | EVIDENCE | BLOCKER / NOTES |
|-----------|--------|----------|-----------------|
| **Gate 5 Security** | VERIFIED | 204/204 tests pass (fix/gate5-security-rebuild @ c2081f9); distributed rate limiter implemented; 0 runtime security blockers | None |
| **Railway Staging** | BLOCKED | Not provisioned; owned by Agent 2 | Railway project not created |
| **Postgres Staging** | BLOCKED | Not provisioned; managed PG required | Depends on Railway Staging |
| **Redis Staging** | BLOCKED | Not provisioned; required for distributed rate limiting | Depends on Railway Staging |
| **Jessie Backend (API)** | VERIFIED | 124 routes, heuristic provider, conversations, prompts, knowledge base; local PG verified | ElevenLabs binding not yet verified |
| **ElevenLabs Binding** | IMPLEMENTED_NOT_VERIFIED | Agent/tool config exists in codebase; backend binding not verified in staging | Requires staging + controlled call verification |
| **Make Standard Route** | IMPLEMENTED_NOT_VERIFIED | Phase 1 receiver scenario exists; not executed in staging | Gmail auth / staging verification may be required |
| **Make Escalation Route** | IMPLEMENTED_NOT_VERIFIED | Escalation logic exists; not executed in staging | Requires staging verification |
| **Gmail Escalation** | IMPLEMENTED_NOT_VERIFIED | Escalation logic exists; not executed in staging | Requires staging verification |
| **Appointment Request (detail collection)** | VERIFIED | Heuristic collects date/time/clinician/type; no booking action | Booking action = FUTURE |
| **Appointment Booking (confirmed)** | FUTURE | Not implemented; requires tool calling + scheduling API | Tool calling framework not implemented |
| **Telephony Transfer (voice)** | FUTURE | Not implemented; requires Twilio Voice + STT/TTS | No telephony integration |
| **Controlled Voice Call** | BLOCKED | Requires staging + telephony + ElevenLabs binding verified | Multiple dependencies |
| **Client Onboarding Process** | VERIFIED (template) | `JESSIE_CLIENT_ONBOARDING_TEMPLATE.md` complete; no automated wizard | Manual process only |
| **Support Process** | IMPLEMENTED_NOT_VERIFIED | `JESSIE_SUPPORT_AND_INCIDENT_PLAN.md` template; no on-call staffed | Requires operational staffing |
| **Commercial Demo** | IMPLEMENTED_NOT_VERIFIED | Script complete; requires staging for live demo | Staging not provisioned |
| **Commercial Go-Live** | BLOCKED | Requires all above VERIFIED + client signoff | Full chain not passed |

---

## Status Summary

| Category | VERIFIED | IMPLEMENTED_NOT_VERIFIED | IN_PROGRESS | BLOCKED | FUTURE |
|----------|----------|-------------------------|-------------|---------|--------|
| Security / Gate 5 | 1 | 0 | 0 | 0 | 0 |
| Staging / Infra | 0 | 0 | 0 | 3 | 0 |
| Jessie Backend | 1 | 1 | 0 | 0 | 0 |
| ElevenLabs / Make | 0 | 3 | 0 | 0 | 0 |
| Appointment / Scheduling | 1 | 0 | 0 | 0 | 1 |
| Telephony / Voice | 0 | 0 | 0 | 1 | 1 |
| Onboarding / Support | 1 | 1 | 0 | 0 | 0 |
| Commercial Launch | 0 | 1 | 0 | 1 | 0 |
| **TOTAL** | **4** | **6** | **0** | **5** | **1** |

---

## Key Blockers for Commercial Launch

1. **No Staging Environment** — Railway, Postgres, Redis not provisioned (Agent 2)
2. **No Telephony Integration** — Twilio Voice, STT, TTS not integrated
3. **No Tool Calling Framework** — Heuristic simulates but cannot execute API actions
4. **ElevenLabs Binding Unverified** — Config exists but not tested in staging
4. **Make Routes Unverified** — Standard/escalation/Gmail routes not executed in staging
5. **No Verified Controlled Voice Call** — Requires staging + telephony + binding
6. **Support Operations Unstaffed** — Template exists but no on-call rotation
7. **Commercial Go-Live Chain Incomplete** — Full dependency chain not VERIFIED

---

## Evidence Index (Verified Only)

| Component | Key Files / Evidence |
|-----------|---------------------|
| Gate 5 Security | `fix/gate5-security-rebuild` branch @ c2081f9; 204/204 tests pass; distributed rate limiter |
| Jessie Backend (heuristic) | `apps/api/src/ai/chat/heuristic-chat.provider.ts`; `apps/api/src/modules/jessie/`; 124 routes |
| Conversation Memory | `apps/api/src/modules/jessie/conversations.service.ts`; `ConversationMessage` model |
| Prompt Management | `apps/api/src/modules/jessie/prompts.service.ts`; `PromptTemplate` model |
| Knowledge Base | `apps/api/src/modules/jessie/knowledge.service.ts`; `KnowledgeArticle` model |
| Auth (JWT/RBAC/MFA) | `apps/api/src/auth/`; 17 API tests pass; MFA + token rotation |
| Client Onboarding Template | `docs/JESSIE_CLIENT_ONBOARDING_TEMPLATE.md` |
| Support Incident Plan | `docs/JESSIE_SUPPORT_AND_INCIDENT_PLAN.md` |
| Commercial Demo Script | `docs/JESSIE_COMMERCIAL_DEMO_SCRIPT.md` |
| Sales Claims Guardrail | `docs/JESSIE_APPROVED_SALES_CLAIMS.md` |

---

## Gate Status for Commercial Launch

| Gate | Status | Blocking Items |
|------|--------|----------------|
| **Gate 5 — Security** | VERIFIED | None (204/204 tests pass, 0 runtime blockers) |
| **Railway Staging** | BLOCKED | Railway project not provisioned (Agent 2) |
| **Postgres Staging** | BLOCKED | Depends on Railway |
| **Redis Staging** | BLOCKED | Depends on Railway |
| **Jessie Backend** | VERIFIED | Local only; staging binding pending |
| **ElevenLabs Binding** | IMPLEMENTED_NOT_VERIFIED | Requires staging + controlled call |
| **Make Routes (std/escalation/Gmail)** | IMPLEMENTED_NOT_VERIFIED | Requires staging verification |
| **Appointment Request** | VERIFIED | Detail collection only; booking = FUTURE |
| **Telephony Transfer** | FUTURE | Requires Twilio Voice + STT/TTS |
| **Controlled Voice Call** | BLOCKED | Requires staging + telephony + binding |
| **Client Onboarding** | VERIFIED (template) | Manual process only |
| **Support Process** | IMPLEMENTED_NOT_VERIFIED | Template only; no staffed on-call |
| **Commercial Demo** | IMPLEMENTED_NOT_VERIFIED | Requires staging |
| **Commercial Go-Live** | BLOCKED | Full chain not VERIFIED |

---

## Legend

- **VERIFIED** = Runtime evidence in target environment (tests pass, smoke test, live call)
- **IMPLEMENTED_NOT_VERIFIED** = Code exists but not yet executed/verified in staging
- **IN_PROGRESS** = Active development (currently none)
- **BLOCKED** = Missing hard dependency (infra, integration, staffing)
- **FUTURE** = Planned but not implemented; not a current launch blocker