# Jessie Commercial Status Matrix

**Source of truth for commercial readiness. Updated per release.**
**Status values: READY | NEEDS VERIFICATION | BLOCKED | NOT REQUIRED**
**Evidence = repo path, test result, doc, or "N/A"**

---

| COMPONENT | STATUS | EVIDENCE | OWNER | BLOCKER | NEXT ACTION |
|-----------|--------|----------|-------|---------|-------------|
| **ElevenLabs Agent** | NOT REQUIRED | Not in codebase; no ElevenLabs integration | N/A | N/A | Decide if needed vs. Twilio Voice + TTS |
| **System Prompt (per kind)** | READY | `apps/api/src/ai/chat/assistant-prompts.ts` — 6 defaults | Eng | None | None |
| **Voice (TTS)** | BLOCKED | No TTS integration; no speech provider | Eng | ElevenLabs/Deepgram/Twilio TTS not integrated | Select TTS provider; build adapter |
| **Guardrails (PII, injection)** | NEEDS VERIFICATION | Heuristic ignores injection; LLM needs guardrails | Eng | LLM guardrails not implemented | Implement PII redaction + prompt injection shield for LLM |
| **Client Resolution (lookup_client)** | BLOCKED | No tool calling; heuristic simulates only | Eng | Function calling / tool use not implemented | Implement tool calling framework |
| **Capture Lead** | READY (heuristic) | `heuristic-chat.provider.ts:104-114` — 6-step intake | Eng | No API persistence to Client model | Build intake → Client create automation |
| **Appointment Request** | READY (heuristic) | `heuristic-chat.provider.ts:96-102` — collects details | Eng | No API booking action | Implement scheduling tool calling |
| **Transfer** | READY (intent only) | Heuristic acknowledges; no execution | Eng | Twilio Voice integration missing | Build telephony webhook + transfer logic |
| **Callback/Message** | READY (intent only) | Heuristic offers callback; no notification send | Eng | Notification delivery not wired | Wire to Resend/Twilio/console |
| **Call Outcome Logging** | READY | `ConversationMessage` + `AuditLog` on every turn | Eng | None | None |
| **Business Info (knowledge)** | READY | `KnowledgeArticle` CRUD + keyword retrieval | Eng | Semantic search not implemented | Add embeddings + vector search |
| **Railway Staging** | BLOCKED | No staging env provisioned | Infra | Railway project not created | Provision Railway; deploy staging |
| **Database (PostgreSQL)** | READY (local) | 13 migrations applied cleanly on real PG | Eng | Managed PG not provisioned for prod | Provision managed PG (RDS/Cloud SQL/Railway) |
| **Auth (JWT/RBAC/MFA)** | READY | 17 API tests pass; MFA + token rotation verified | Eng | None | None |
| **Telephony (Twilio Voice)** | BLOCKED | SMS adapter only; no Voice webhook | Eng | Twilio Voice not integrated | Build Voice webhook + TwiML responses |
| **Phone Number** | BLOCKED | No provisioning automation | Ops | Manual process | Document manual process; automate later |
| **Live Call (controlled)** | BLOCKED | Requires telephony + staging | Eng | Telephony + staging both blocked | Unblock telephony + staging first |
| **Test Suite** | READY (unit) | 29 unit tests pass (core + API) | Eng | No e2e / load / chaos tests | Add e2e happy paths; load test |
| **Monitoring** | BLOCKED | No centralized logging/metrics/alerting | Infra | Not provisioned | Select stack (Datadog/Sentry/Loki); implement |
| **Billing (Jessie usage)** | BLOCKED | No usage metering; no Jessie pricing model | Product | Pricing not defined | Define pricing; implement metering |
| **Onboarding** | READY (template) | `JESSIE_CLIENT_ONBOARDING_TEMPLATE.md` created | PM | No automated wizard | Build guided setup UI (roadmap) |
| **Support** | BLOCKED | No tier definitions, on-call, runbooks | Ops | `JESSIE_SUPPORT_AND_INCIDENT_PLAN.md` is template only | Staff on-call; finalize runbooks |
| **Legal/Compliance** | BLOCKED | Technical safeguards only; admin/physical/BAAs missing | Legal | BAAs, policies, risk assessment, breach proc | Execute BAAs; write admin procedures |
| **Commercial Demo** | READY (script) | `JESSIE_COMMERCIAL_DEMO_SCRIPT.md` created | PM | Staging env for live demo | Provision staging for demo use |

---

## Status Summary

| Category | READY | NEEDS VERIFICATION | BLOCKED | NOT REQUIRED |
|----------|-------|-------------------|---------|--------------|
| Core AI | 5 | 1 | 4 | 1 |
| Backend/Infra | 3 | 0 | 5 | 0 |
| Telephony/Voice | 0 | 0 | 4 | 0 |
| Testing | 1 | 0 | 2 | 0 |
| Ops/Support | 0 | 0 | 3 | 0 |
| Legal/Compliance | 0 | 0 | 1 | 0 |
| **TOTAL** | **9** | **1** | **19** | **1** |

---

## Key Blockers for Commercial Launch

1. **Telephony Integration** — No Twilio Voice; no inbound call handling; no transfers
2. **Staging Environment** — No hosted env for demo/client validation
3. **Tool Calling / Function Execution** — Heuristic simulates but cannot execute API actions (booking, client create, transfer)
4. **LLM Guardrails** — No PII redaction, prompt injection protection for live LLM
5. **Monitoring/Alerting** — No observability stack
6. **Managed Database** — No production PostgreSQL
7. **BAAs / Compliance** — Required before PHI in production
8. **Support Operations** — No on-call, runbooks, SLA definitions
9. **Billing/Metering** — No usage tracking for Jessie standalone

---

## Evidence Index

| Component | Key Files |
|-----------|-----------|
| Heuristic Chat Provider | `apps/api/src/ai/chat/heuristic-chat.provider.ts` |
| LLM Chat Provider | `apps/api/src/ai/chat/llm-chat.provider.ts` |
| Assistant Prompts | `apps/api/src/ai/chat/assistant-prompts.ts` |
| Conversations Service | `apps/api/src/modules/jessie/conversations.service.ts` |
| Prompts Service | `apps/api/src/modules/jessie/prompts.service.ts` |
| Knowledge Service | `apps/api/src/modules/jessie/knowledge.service.ts` |
| AI Module (provider binding) | `apps/api/src/ai/ai.module.ts` |
| Chat Provider Interface | `apps/api/src/ai/chat/chat-provider.interface.ts` |
| Jessie Controller | `apps/api/src/modules/jessie/jessie.controller.ts` |
| Database Schema (Jessie) | `packages/database/prisma/schema.prisma` (lines 334-428) |
| Jessie Migration | `packages/database/prisma/migrations/20260725300000_jessie_ai/migration.sql` |
| Unit Tests | `apps/api/src/ai/heuristic-note-assistant.spec.ts`, `packages/core/src/*.test.ts` |
| Current Status Doc | `docs/CURRENT_STATUS.md` (Phase 9) |
| Master Plan | `PROJECT_MASTER_PLAN.md` (§3, §13) |
| Demo Package | `docs/SBOS_DEMO_PACKAGE.md` |
| Release Checklist | `RELEASE_1_CHECKLIST.md` |
| Production Readiness | `docs/PRODUCTION_READINESS_CHECKLIST.md` |

---

## Gate Status for Commercial Launch

| Gate | Status | Blocking Items |
|------|--------|----------------|
| **GATE A — SECURITY** | NEEDS VERIFICATION | Pen test, BAAs, encryption at rest, secrets manager |
| **GATE B — STAGING** | BLOCKED | Railway/project provisioning |
| **GATE C — BACKEND TOOLS** | BLOCKED | Tool calling / function execution for scheduling, intake, transfer |
| **GATE D — ELEVENLABS/VOICE** | BLOCKED | TTS provider selection + integration |
| **GATE E — PHONE/TELEPHONY** | BLOCKED | Twilio Voice webhook + TwiML |
| **GATE F — CONTROLLED CALL** | BLOCKED | Requires Gates D + E + B |
| **GATE G — COMMERCIAL DEMO** | NEEDS VERIFICATION | Requires Gate B (staging) for live demo |
| **GATE H — CLIENT LAUNCH** | BLOCKED | Requires Gates A–G + support ops + billing + legal |