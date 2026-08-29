# Jessie Support and Incident Plan

**Scope:** Covers the Jessie AI assistant layer (chat, prompts, knowledge, conversations) as a commercial offering.
**Status:** Template — adapt per client SLA and operational maturity.
**Owner:** Engineering + Support lead

---

## Severity Definitions

| Severity | Definition | Target Response | Target Resolution |
|----------|------------|-----------------|-------------------|
| **SEV-1** | Complete Jessie outage for a client; all conversations fail; no fallback | 15 min | 1 hour |
| **SEV-2** | Partial degradation: one assistant kind failing, slow responses (>10s), knowledge retrieval broken, transfer intent not recognized | 30 min | 4 hours |
| **SEV-3** | Minor issue: single conversation error, prompt template not loading, knowledge article not publishing, cosmetic UI issue | 4 hours | 1 business day |

---

## Incident Types & Response

### 1. Tool Failure (LLM Provider Down)
**Symptoms:** `LLM provider error: 5xx` in logs; `generateReply` throws; heuristic not falling back
**Detection:** Health check `/api/v1/health` + chat provider error rate spike
**SEV:** 1 if all clients affected; 2 if single-tenant (provider config issue)
**Response:**
1. Verify `OPENAI_API_KEY` / `AI_BASE_URL` validity
2. Check provider status page
3. **Fallback:** Code already falls back to `HeuristicChatProvider` if no API key — but if key exists and provider fails, it throws. **Immediate mitigation:** Temporarily unset `OPENAI_API_KEY` for affected tenant (requires deploy) or implement circuit breaker (roadmap).
4. Notify client: "AI responses temporarily using offline mode; full capability restored when provider recovers"
**Runbook:** `docs/runbooks/llm-provider-down.md` (to be created)

### 2. Backend Outage (API / Database)
**Symptoms:** API `/health` fails; DB connection errors; conversations cannot be created/retrieved
**Detection:** Monitoring alerts (uptime, error rate, DB connection pool)
**SEV:** 1
**Response:**
1. Check container health (`docker compose ps`)
2. Check DB connectivity (`pg_isready`)
3. Restart API container if OOM / stuck
4. If DB: failover to replica / restore from backup
5. Jessie conversations unavailable — client sees "Service temporarily unavailable"
**Runbook:** `docs/runbooks/backend-outage.md`

### 3. Telephony Outage (Twilio Voice / SIP)
**Symptoms:** Inbound calls not reaching Jessie webhook; calls drop; no audio
**Detection:** Twilio console alerts; client reports; webhook error rate
**SEV:** 1 for voice-enabled clients; N/A for text-only
**Response:**
1. Check Twilio console for incidents
2. Verify webhook URL reachable from Twilio IPs
3. Check API logs for webhook handler errors
4. **Fallback:** Route calls to voicemail / on-call number via Twilio console
5. Jessie text/chat continues unaffected
**Runbook:** `docs/runbooks/telephony-outage.md`

### 4. Wrong Client Lookup (Multi-tenant Leak)
**Symptoms:** Caller sees another org's knowledge/greeting; conversation attributed to wrong org
**Detection:** Audit log review; client complaint; automated test
**SEV:** 1 (data isolation breach)
**Response:**
1. **Immediate:** Disable affected org's Jessie access (feature flag)
2. Investigate: check `organizationId` scoping in `ConversationsService`, `PromptsService`, `KnowledgeService`
3. Check for missing `organizationId` in webhook/telephony payload
4. Rotate any exposed data; notify affected clients per breach procedure
5. Root cause: missing tenant scope in query or middleware
**Runbook:** `docs/runbooks/tenant-isolation-breach.md`

### 5. Transfer Failure
**Symptoms:** Caller asks for human; Jessie acknowledges but no transfer occurs; caller stuck
**Detection:** Client complaint; conversation logs show transfer intent unfulfilled
**SEV:** 2 (voice); 3 (text — human follows up via callback)
**Response:**
1. Verify transfer destination config exists for that org
2. Check telephony webhook handler for transfer logic (roadmap — not yet implemented)
3. **Current behavior:** Heuristic says "I'll connect you" but no action. Document as known limitation.
4. **Mitigation:** Ensure after-hours / escalation config routes to voicemail/callback
5. Notify client: "Transfer recognition works; execution requires telephony integration (roadmap). Current fallback: callback request logged."
**Runbook:** `docs/runbooks/transfer-failure.md`

### 6. Booking Failure
**Symptoms:** Caller provides booking details; Jessie confirms but no appointment created
**Detection:** Client complaint; conversation shows booking intent; no appointment in SBOS
**SEV:** 2
**Response:**
1. **Current behavior:** Heuristic simulates booking; no API action. Document as known limitation.
2. Verify SCHEDULING assistant prompt instructs caller correctly
3. **Mitigation:** Callback process — human books manually from lead data
4. Notify client: "Booking detail collection works; automated booking requires tool-calling integration (roadmap). Leads captured for manual follow-up."
**Runbook:** `docs/runbooks/booking-failure.md`

### 7. Incorrect Business Answer
**Symptoms:** Jessie gives wrong hours, wrong service info, hallucinates policy
**Detection:** Client complaint; audit log review; conversation replay
**SEV:** 2 (wrong critical info); 3 (minor)
**Response:**
1. Check KnowledgeArticle: is correct article published? Tags correct?
2. Check PromptTemplate: does system prompt restrict to knowledge base?
3. If LLM: possible hallucination — enable stricter grounding / lower temperature
4. If heuristic: keyword match may have retrieved wrong article — improve tags
5. **Immediate fix:** Update/unpublish incorrect KnowledgeArticle; update PromptTemplate
6. Notify client: "Knowledge base corrected. Review your published articles quarterly."
**Runbook:** `docs/runbooks/incorrect-answer.md`

### 8. Caller Complaint
**Symptoms:** Caller reports rude, unhelpful, confusing, or inappropriate response
**Detection:** Client forwards complaint; support ticket; social media
**SEV:** 2 (repeated pattern); 3 (isolated)
**Response:**
1. Pull conversation from audit log (`ConversationMessage` + `AuditLog`)
2. Replay: what assistant kind? What prompt? What knowledge?
3. Classify: prompt issue / knowledge gap / heuristic limitation / LLM hallucination
4. Fix: update PromptTemplate, add KnowledgeArticle, adjust heuristic (code change)
5. Respond to client with root cause and fix deployed
**Runbook:** `docs/runbooks/caller-complaint.md`

### 9. Data Privacy Issue
**Symptoms:** PII in logs; conversation exported incorrectly; unauthorized access
**Detection:** Audit log review; client report; automated scan
**SEV:** 1 (PHI exposure)
**Response:**
1. **Immediate:** Contain — disable export/access feature; rotate keys
2. Assess scope: which orgs, which conversations, what data
3. Notify client per BAA/breach notification procedure
4. Root cause: logging interceptor, audit log, or export endpoint
5. Fix: PII redaction in logs (roadmap); access control audit
6. Document in incident tracker
**Runbook:** `docs/runbooks/data-privacy-incident.md`

### 10. Service Degradation (Slow Responses)
**Symptoms:** Chat responses >10s; timeouts; high latency
**Detection:** APM alerts; client reports
**SEV:** 2
**Response:**
1. Check LLM provider latency (if live) — `AI_BASE_URL` region
2. Check DB query performance (conversation history retrieval)
3. Check API container CPU/memory
4. **Mitigation:** Reduce conversation history window (currently full history); implement summarization (roadmap)
5. If heuristic: should be <100ms — investigate container health
**Runbook:** `docs/runbooks/service-degradation.md`

---

## Safe Fallback Behaviors (Built-in)

| Failure Mode | Current Fallback | Gap |
|--------------|------------------|-----|
| LLM provider down | **None** — throws error (requires circuit breaker) | Implement automatic fallback to heuristic when LLM errors |
| DB unavailable | API health fails; no conversations | Read-only cached prompts/knowledge (not implemented) |
| Knowledge retrieval empty | Heuristic responds without grounding | Acceptable |
| PromptTemplate missing | Built-in `DEFAULT_SYSTEM_PROMPTS` used | Acceptable |
| Transfer intent recognized | Heuristic acknowledges; no action | Telephony integration needed |
| Booking intent recognized | Heuristic collects details; no action | Tool calling needed |
| After-hours | Prompt-driven (configured in system prompt) | Time-aware logic not in heuristic |

---

## Escalation Contacts

| Role | Name | Phone | Email | Hours |
|------|------|-------|-------|-------|
| Jessie On-Call (Primary) | | | | |
| Jessie On-Call (Secondary) | | | | |
| Engineering Lead | | | | |
| Product Lead | | | | |
| Client Success Lead | | | | |
| Legal/Compliance | | | | |

---

## Communication Templates

### Client Notification (SEV-1)
> **Subject:** [URGENT] Jessie Service Disruption — [Client Name]
>
> We're investigating an issue affecting Jessie for your organization. Current impact: [description]. Estimated resolution: [time]. We'll update every 30 minutes. Fallback: [heuristic mode / voicemail / callback]. Contact: [on-call phone].

### Client Notification (SEV-2/3)
> **Subject:** Jessie Service Notice — [Client Name]
>
> We've identified a partial issue: [description]. Impact: [specific capability]. Resolution target: [time]. Workaround: [if any]. No action needed on your end.

### Post-Incident Review (All SEV-1, SEV-2 patterns)
- Timeline with timestamps
- Root cause (5 Whys)
- Action items with owners + due dates
- Client communication log
- Metrics: MTTR, impact radius, recurrence risk

---

## On-Call Rotation

- **Schedule:** Weekly rotation, 2 engineers minimum
- **Handoff:** Friday 5pm local; includes open incidents, deploy status, known issues
- **Tools:** PagerDuty / Opsgenie (to be configured); Slack #jessie-oncall
- **Runbook Access:** All runbooks in `docs/runbooks/` (to be created)

---

## Metrics to Monitor (Post-Launch)

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Chat response time (p95) | <3s (heuristic), <8s (LLM) | >10s |
| Conversation success rate | >99% | <98% |
| Fallback rate (LLM → heuristic) | <1% | >5% |
| Transfer intent recognition rate | >95% | <90% |
| Knowledge retrieval hit rate | >80% | <60% |
| Error rate (5xx) | <0.1% | >0.5% |
| Audit log write latency | <100ms | >500ms |

---

## Runbook Index (To Be Created)

- `docs/runbooks/llm-provider-down.md`
- `docs/runbooks/backend-outage.md`
- `docs/runbooks/telephony-outage.md`
- `docs/runbooks/tenant-isolation-breach.md`
- `docs/runbooks/transfer-failure.md`
- `docs/runbooks/booking-failure.md`
- `docs/runbooks/incorrect-answer.md`
- `docs/runbooks/caller-complaint.md`
- `docs/runbooks/data-privacy-incident.md`
- `docs/runbooks/service-degradation.md`

---

## Review Cadence

- **Weekly:** On-call review open incidents, update runbooks
- **Monthly:** Incident retrospective; update severity definitions
- **Quarterly:** Full DR drill; test fallback behaviors; review SLA compliance