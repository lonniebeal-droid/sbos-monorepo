# Jessie Client Launch Checklist

**Required before any client goes live with Jessie.**
**Each item must be verified and signed off.**
**No exceptions.**

---

## Client: ________________________
## Target Launch Date: _______________
## Implementation Lead: _______________

---

### 1. Onboarding Completed

- [ ] **Onboarding template complete** — All fields in `JESSIE_CLIENT_ONBOARDING_TEMPLATE.md` filled and approved
- [ ] **Client sign-off recorded** — Primary contact signed onboarding document
- [ ] **Internal handoff done** — Implementation lead has all config details

---

### 2. Client Configuration Verified

- [ ] **Organization created in SBOS** — Org ID: _______________
- [ ] **Timezone set** — `Organization.timezone` = client IANA timezone
- [ ] **Business hours configured** — In RECEPTIONIST system prompt (hours not yet modeled separately)
- [ ] **Custom greeting deployed** — `PromptTemplate` for RECEPTIONIST with `custom_greeting`
- [ ] **Custom instructions deployed** — Additional prompt additions per `custom_instructions`
- [ ] **All PromptTemplates active** — For each enabled assistant kind (RECEPTIONIST minimum)

---

### 3. Knowledge Base Reviewed

- [ ] **All FAQs published** — `KnowledgeArticle.isPublished = true` for every approved Q&A
- [ ] **Tags applied** — Each article has relevant tags for retrieval
- [ ] **Content accuracy verified** — Client reviewed every article answer
- [ ] **No stale/conflicting articles** — Search test passes for top 20 caller questions
- [ ] **Fallback behavior confirmed** — "Not found" response tested and approved

---

### 4. Lead Capture Verified

- [ ] **Lead questions configured** — INTAKE assistant prompt matches `lead_questions`
- [ ] **Field order matches client process** — Name → DOB → Contact → Concern → Insurance
- [ ] **Data capture tested** — Test conversation collects all fields in order
- [ ] **Callback process defined** — Who receives lead, SLA, notification method

---

### 5. Transfer Destinations Verified

- [ ] **Destinations documented** — List in onboarding matches configured intent
- [ ] **Transfer rules mapped** — Intent → destination (billing, clinical, after-hours, emergency)
- [ ] **After-hours behavior set** — Voicemail / callback / on-call per config
- [ ] **Escalation contacts current** — Names, phones, emails, hours verified
- [ ] **Emergency keywords configured** — In RECEPTIONIST/INTAKE prompts (suicide, overdose, harm, crisis)

---

### 6. Booking Mode Verified

- [ ] **Booking enabled/disabled** — Matches client requirement (`booking_enabled`)
- [ ] **If enabled: rules documented** — Appointment types, lead time, max advance, clinician assignment
- [ ] **If enabled: SCHEDULING prompt tested** — Collects correct details
- [ ] **Client understands limitation** — **Signed acknowledgment** that booking is detail-collection only; human confirms (tool calling not yet implemented)

---

### 7. Callback Process Verified

- [ ] **Callback fields defined** — What Jessie collects for callback request
- [ ] **Notification tested** — Email/SMS/console log to designated recipient
- [ ] **SLA documented** — Target callback time communicated to client
- [ ] **After-hours callback rule** — Defined and tested

---

### 8. Restricted Claims Configured

- [ ] **Prohibited phrases in prompts** — "guarantee", "medical advice", "100%", "fully compliant" added to system prompts as negative constraints
- [ ] **Emergency escalation tested** — Keywords trigger "I'm connecting you with a human immediately"
- [ ] **Client legal review complete** — Client's counsel approved restricted statements list

---

### 9. Test Calls Passed

| Test Case | Pass/Fail | Notes |
|-----------|-----------|-------|
| Basic greeting + hours question | | |
| Service question (grounded) | | |
| New client intake (full flow) | | |
| Appointment request (detail collection) | | |
| Transfer request ("speak to human") | | |
| After-hours call (simulated) | | |
| Unsupported question (stock price) | | |
| Prompt injection attempt | | |
| Emergency keyword ("suicide") | | |
| Multi-turn memory (context carry) | | |
| Knowledge article not found | | |
| Custom greeting plays | | |

- [ ] **All test cases PASS** — No failures
- [ ] **Conversation logs reviewed** — Audit trail complete for each test
- [ ] **Provider metadata correct** — `heuristic-chat-v1` (or `llm:model` if live)

---

### 10. Failed-Tool Fallback Passed

- [ ] **LLM key removed temporarily** — Heuristic provider activates automatically
- [ ] **All test cases re-run** — Same flows work on heuristic
- [ ] **Client informed** — "If LLM provider fails, Jessie switches to offline mode automatically"
- [ ] **LLM key restored** — Live provider re-verified

---

### 11. Human Escalation Verified

- [ ] **Escalation path tested** — Caller says "emergency" → immediate human connect message
- [ ] **On-call contact notified** — Test page/alert sent to escalation contacts
- [ ] **Voicemail fallback tested** — After-hours routes to voicemail (if configured)
- [ ] **Callback request logged** — Appears in conversation history + notification sent

---

### 12. Monitoring & Logging Enabled

- [ ] **Audit logging confirmed** — `AuditLog` entries for all test conversations
- [ ] **Conversation visibility** — Client can see conversations in SBOS (if licensed) or export provided
- [ ] **Error alerting configured** — 5xx rate alerts to on-call (when monitoring provisioned)
- [ ] **Usage baseline recorded** — Expected daily conversation volume for capacity planning

---

### 13. Client Signoff Recorded

| Item | Client Initials | Date |
|------|-----------------|------|
| Onboarding template accurate | | |
| Knowledge base answers approved | | |
| Lead capture fields correct | | |
| Transfer/escalation rules correct | | |
| Booking limitation acknowledged | | |
| Restricted claims configured | | |
| Test calls approved | | |
| Fallback behavior understood | | |
| Emergency escalation tested | | |
| Monitoring/logging scope understood | | |
| **GO/NO-GO for launch** | | |

**Client Authorization:** _________________________ **Date:** ___________

**Implementation Lead Authorization:** _________________________ **Date:** ___________

---

### 14. Launch Day Checklist (Day Of)

- [ ] **Phone number pointed to Jessie webhook** — Verified inbound call reaches API
- [ ] **Feature flags enabled** — `jessie_chat`, `jessie_voice` (if applicable) for this org
- [ ] **Live LLM key configured** (if applicable) — `OPENAI_API_KEY` per org or global
- [ ] **Twilio SMS configured** (if applicable) — Confirmation messages send
- [ ] **First live call monitored** — Implementation lead on call for first 3 live calls
- [ ] **Rollback plan ready** — Feature flag disable procedure documented
- [ ] **Client support contact confirmed** — Client knows how to report issues Day 1

---

### 15. Post-Launch (Day 1–7)

- [ ] **Daily conversation review** — First 7 days: review all conversations for quality
- [ ] **Client check-in (Day 1)** — 30-min call: any issues, feedback
- [ ] **Client check-in (Day 3)** — Review metrics, adjust prompts/knowledge if needed
- [ ] **Client check-in (Day 7)** — Formal review; sign off on "steady state"
- [ ] **Knowledge base updates** — Any new FAQs from real calls added
- [ ] **Prompt refinements** — Any tone/behavior adjustments deployed

---

## Launch Gate: ALL ITEMS MUST BE CHECKED

**No partial launches.** If any item is BLOCKED or FAIL, launch is delayed until resolved.

**Exceptions require:** Written approval from Engineering Lead + Product Lead + Client