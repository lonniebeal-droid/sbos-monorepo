# Standard vs Escalation Routing Examples

**Purpose:** Concrete examples showing how Jessie routes callers to Standard vs Escalation Make webhooks based on intent, keywords, and configuration.

**Routing Logic:** Evaluated in order — first match wins.
**Configuration:** Per-organization via `PromptTemplate` (system prompt) + `FeatureFlag` (escalation rules)

---

## Routing Decision Tree

```
Caller Intent/Utterance
        │
        ▼
┌───────────────────┐
│ Emergency Keywords? │──YES──→ Escalation Route (emergency.escalated)
│ (suicide, overdose, │
│  harm, crisis,      │
│  emergency)         │
└─────────┬───────────┘
          │ NO
          ▼
┌───────────────────┐
│ Transfer Intent?  │──YES──→ Check Destination Type
│ (human, person,   │
│  operator, agent) │
└─────────┬───────────┘
          │ NO
          ▼
┌───────────────────┐
│ Clinical Concern? │──YES──→ Escalation Route (clinical.concern)
│ (medication,      │
│  diagnosis,       │
│  symptoms,        │
│  therapy question)│
└─────────┬───────────┘
          │ NO
          ▼
┌───────────────────┐
│ Billing/Insurance?│──YES──→ Standard Route (transfer.initiated → EXTENSION:billing)
│ (bill, invoice,   │
│  insurance,       │
│  payment, claim)  │
└─────────┬───────────┘
          │ NO
          ▼
┌───────────────────┐
│ After Hours?      │──YES──→ Standard Route (callback.requested or voicemail)
│ (per org hours)   │
└─────────┬───────────┘
          │ NO
          ▼
┌───────────────────┐
│ Scheduling/Intake?│──YES──→ Standard Route (lead.captured / appointment.booked)
│ (appointment,     │
│  new client,      │
│  intake)          │
└─────────┬───────────┘
          │ NO
          ▼
      Standard Route
      (Information
       Provided)
```

---

## Standard Route Examples

### Example 1: New Client Intake → Lead Captured
**Caller:** "Hi, I'm looking for a therapist for anxiety. I've never been to therapy before."
**Jessie Assistant:** INTAKE
**Flow:**
1. Jessie walks 6-step intake (name, DOB, contact, concern, insurance)
2. `capture_lead` tool called
3. `send_message_or_callback_request` (SMS_STAFF to FRONT_DESK) — "New lead: Alex Rivera, anxiety"
4. `log_call_outcome` with `outcome=LEAD_CAPTURED`

**Make Events:**
- `lead.captured` → Google Sheets **Leads** tab
- `callback.requested` (if caller asked for callback) → Google Sheets **Callbacks** tab

**Standard Route Webhook Payload:**
```json
{
  "event": "lead.captured",
  "data": {
    "clientId": "cl_staging_new001",
    "mrn": "LEAD-20260829T183000",
    "firstName": "Alex",
    "lastName": "Rivera",
    "presentingConcern": "Anxiety, never been to therapy",
    "insuranceCarrier": "Blue Cross Blue Shield",
    "source": "PHONE"
  }
}
```

---

### Example 2: Existing Client Books Appointment
**Caller:** "This is Jordan Mitchell. I'd like to schedule my next session with Dr. Smith for next Tuesday afternoon."
**Jessie Assistant:** SCHEDULING
**Flow:**
1. `lookup_client` by name + DOB or MRN
2. `create_or_request_appointment` (CHECK_AVAILABILITY) for Dr. Smith, Tuesday
3. Caller picks slot → `create_or_request_appointment` (BOOK)
4. `log_call_outcome` with `outcome=APPOINTMENT_BOOKED`

**Make Events:**
- `appointment.booked` → Google Sheets **Appointments** tab

**Standard Route Webhook Payload:**
```json
{
  "event": "appointment.booked",
  "data": {
    "appointmentId": "appt_staging_001",
    "clientId": "cl_staging_xyz789",
    "clientMrn": "SB-10247",
    "clientName": "Jordan Mitchell",
    "clinicianId": "clin_staging_001",
    "clinicianName": "Dr. Sarah Smith",
    "type": "INDIVIDUAL",
    "startTime": "2026-09-02T19:00:00.000Z",
    "isTelehealth": false
  }
}
```

---

### Example 3: Billing Question → Transfer to Billing Dept
**Caller:** "I have a question about my invoice INV-2026-0042. The amount seems wrong."
**Jessie Assistant:** RECEPTIONIST
**Flow:**
1. Recognizes billing intent
2. Checks org config: `billing → EXTENSION:101`
3. `transfer_call` to `EXTENSION:101` (WARM)
3. `log_call_outcome` with `outcome=TRANSFERRED_TO_HUMAN`

**Make Events:**
- `transfer.initiated` → Google Sheets **Transfers** tab

**Standard Route Webhook Payload:**
```json
{
  "event": "transfer.initiated",
  "data": {
    "transferId": "xfer_staging_001",
    "transferType": "WARM",
    "destination": { "type": "EXTENSION", "value": "101", "name": "Billing Department" },
    "contextSummary": "Caller Jordan Mitchell (SB-10247) questions invoice INV-2026-0042 amount. Wants payment plan options."
  }
}
```

---

### Example 4: After-Hours Call → Callback Request
**Caller:** (calls at 8 PM) "Is anyone there? I need to schedule an appointment."
**Jessie Assistant:** RECEPTIONIST (after-hours prompt)
**Flow:**
1. Time-aware prompt detects after-hours
2. Offers: "We're closed. Would you like me to take a message and have someone call you back tomorrow?"
3. Caller says yes → `send_message_or_callback_request` (CALLBACK_REQUEST)
4. `log_call_outcome` with `outcome=CALLBACK_REQUESTED`

**Make Events:**
- `callback.requested` → Google Sheets **Callbacks** tab

**Standard Route Webhook Payload:**
```json
{
  "event": "callback.requested",
  "data": {
    "taskId": "task_staging_001",
    "callerName": "Jordan Mitchell",
    "callerPhone": "+15552001010",
    "bestTimeToCall": "Tomorrow 9-11 AM",
    "reason": "Schedule new appointment",
    "priority": "NORMAL",
    "assigneeRole": "FRONT_DESK"
  }
}
```

---

### Example 5: General Information Request
**Caller:** "What are your hours and location?"
**Jessie Assistant:** RECEPTIONIST / KNOWLEDGE
**Flow:**
1. `get_business_information` (category=HOURS) or knowledge base retrieval
2. Jessie answers from KB
3. `log_call_outcome` with `outcome=INFORMATION_PROVIDED`

**Make Events:** None (or `conversation.ended` for analytics)

---

## Escalation Route Examples

### Example 1: Suicide Keyword → Emergency Escalation
**Caller:** "I've been thinking about killing myself. I don't see a way out."
**Jessie Assistant:** RECEPTIONIST / CLINICAL
**Flow:**
1. Keyword "suicide" detected in utterance
2. **Immediate** `transfer_call` to `ON_CALL` (clin_staging_oncall_001)
3. `send_message_or_callback_request` (EMAIL_STAFF to CLINICAL_ON_CALL) — redundant alert
4. `log_call_outcome` with `outcome=EMERGENCY`, tags=["emergency", "suicide"]

**Make Events (Escalation Route):**
- `emergency.escalated` → Gmail to on-call + Google Sheets **Emergency** tab

**Escalation Route Webhook Payload:**
```json
{
  "event": "emergency.escalated",
  "data": {
    "severity": "CRITICAL",
    "trigger": "KEYWORD_DETECTED",
    "keyword": "suicide",
    "callerPhone": "+15554003030",
    "conversationExcerpt": "Caller: \"I've been thinking about killing myself. I don't see a way out.\"",
    "escalationPath": "ON_CALL_CLINICIAN",
    "onCallClinicianId": "clin_staging_oncall_001",
    "onCallClinicianName": "Dr. Emergency Coverage",
    "onCallPhone": "+15559998888",
    "transferred": true,
    "transferId": "xfer_staging_002"
  }
}
```

---

### Example 2: Overdose Mention → Emergency Escalation
**Caller:** "My friend just took a bunch of pills. I think they overdosed."
**Jessie Assistant:** CLINICAL / RECEPTIONIST
**Flow:**
1. Keyword "overdose" detected
2. Immediate `transfer_call` to `ON_CALL` + `QUEUE:911` (if configured)
3. `log_call_outcome` with `outcome=EMERGENCY`, tags=["emergency", "overdose", "third-party"]

**Escalation Route Webhook Payload:**
```json
{
  "event": "emergency.escalated",
  "data": {
    "severity": "CRITICAL",
    "trigger": "KEYWORD_DETECTED",
    "keyword": "overdose",
    "callerPhone": "+15554003030",
    "conversationExcerpt": "Caller: \"My friend just took a bunch of pills. I think they overdosed.\"",
    "escalationPath": "ON_CALL_CLINICIAN + QUEUE:911",
    "onCallClinicianId": "clin_staging_oncall_001",
    "transferred": true,
    "transferId": "xfer_staging_003"
  }
}
```

---

### Example 3: Harm to Others → Emergency Escalation
**Caller:** "I want to hurt my ex. I have a plan."
**Jessie Assistant:** CLINICAL
**Flow:**
1. Keywords "hurt", "harm", "plan" detected together
2. Immediate `transfer_call` to `ON_CALL` + `QUEUE:911`
3. `log_call_outcome` with `outcome=EMERGENCY`, tags=["emergency", "harm-to-others", "duty-to-warn"]

**Escalation Route Webhook Payload:**
```json
{
  "event": "emergency.escalated",
  "data": {
    "severity": "CRITICAL",
    "trigger": "KEYWORD_DETECTED",
    "keyword": "harm",
    "callerPhone": "+15554003030",
    "conversationExcerpt": "Caller: \"I want to hurt my ex. I have a plan.\"",
    "escalationPath": "ON_CALL_CLINICIAN + QUEUE:911",
    "tags": ["harm-to-others", "duty-to-warn"],
    "transferred": true
  }
}
```

---

### Example 4: Clinical Crisis → Transfer Escalation (Not Keyword)
**Caller:** "I'm having a really bad panic attack right now. I can't breathe. I need help."
**Jessie Assistant:** CLINICAL
**Flow:**
1. No emergency keyword, but clinical crisis detected via intent classification
2. `transfer_call` to `ON_CALL` (WARM) — not 911
3. `log_call_outcome` with `outcome=TRANSFERRED_TO_HUMAN`, tags=["clinical-crisis", "panic-attack"]

**Make Events (Escalation Route):**
- `transfer.escalation` → Gmail to on-call + Google Sheets **Transfers** tab

**Escalation Route Webhook Payload:**
```json
{
  "event": "transfer.escalation",
  "data": {
    "transferId": "xfer_staging_004",
    "transferType": "WARM",
    "destination": { "type": "ON_CALL", "value": "clin_staging_oncall_001", "name": "Dr. Emergency Coverage" },
    "contextSummary": "Caller reports severe panic attack, difficulty breathing, requests immediate clinical support. Not a current client.",
    "reason": "CLINICAL_CRISIS",
    "clientId": null,
    "callerPhone": "+15554003030"
  }
}
```

---

### Example 5: Medication Question → Clinical Concern Notification
**Caller:** "I'm taking sertraline 100mg and having weird side effects. Should I stop taking it?"
**Jessie Assistant:** CLINICAL
**Flow:**
1. Recognizes medication question — **does not give medical advice**
4. Responds: "I can't give medical advice. You should discuss this with your prescribing clinician. Would you like me to connect you or have them call you?"
5. Caller says "Have them call me" → `send_message_or_callback_request` (CALLBACK_REQUEST to CLINICAL_ON_CALL)
6. `log_call_outcome` with `outcome=INFORMATION_PROVIDED`, tags=["clinical", "medication-question"]

**Make Events (Escalation Route):**
- `clinical.concern` → Gmail to primary clinician + Google Sheets **Clinical Notes** tab

**Escalation Route Webhook Payload:**
```json
{
  "event": "clinical.concern",
  "data": {
    "outcome": "INFORMATION_PROVIDED",
    "summary": "Client Jordan Mitchell (SB-10247) asked about sertraline side effects. Jessie advised discussing with prescriber. Callback requested.",
    "clientId": "cl_staging_xyz789",
    "clientMrn": "SB-10247",
    "clientName": "Jordan Mitchell",
    "tags": ["clinical", "medication-question"],
    "primaryClinicianId": "clin_staging_001",
    "primaryClinicianName": "Dr. Sarah Smith",
    "primaryClinicianEmail": "dr.smith@springfieldbh.org"
  }
}
```

---

### Example 6: Harm to Others (Third Party) → Duty to Warn
**Caller:** "My husband threatened to kill me. He has a gun."
**Jessie Assistant:** RECEPTIONIST / CLINICAL
**Flow:**
1. Keywords "threatened", "kill", "gun" detected
2. **Immediate** `transfer_call` to `ON_CALL` + `QUEUE:911`
3. `log_call_outcome` with `outcome=EMERGENCY`, tags=["emergency", "domestic-violence", "duty-to-warn", "weapon"]

**Escalation Route Webhook Payload:**
```json
{
  "event": "emergency.escalated",
  "data": {
    "severity": "CRITICAL",
    "trigger": "KEYWORD_DETECTED",
    "keyword": "kill",
    "callerPhone": "+15554003030",
    "conversationExcerpt": "Caller: \"My husband threatened to kill me. He has a gun.\"",
    "escalationPath": "ON_CALL_CLINICIAN + QUEUE:911",
    "tags": ["domestic-violence", "duty-to-warn", "weapon"],
    "transferred": true
  }
}
```

---

## Configuration Reference (Per Organization)

### PromptTemplate Additions (System Prompt)
```text
# Escalation Keywords (case-insensitive)
EMERGENCY_KEYWORDS: ["suicide", "kill myself", "overdose", "harm myself", "hurt myself", "crisis", "emergency", "911"]
CLINICAL_ESCALATION_KEYWORDS: ["panic attack", "can't breathe", "severe anxiety", "psychotic", "hallucination", "medication side effect"]
HARM_TO_OTHERS_KEYWORDS: ["hurt someone", "kill someone", "harm others", "threaten", "gun", "weapon"]

# Routing Rules (intent → destination)
ROUTING_RULES:
  billing: { type: "EXTENSION", value: "101", name: "Billing Department" }
  clinical: { type: "ON_CALL", value: "clin_oncall", name: "On-Call Clinician" }
  scheduling: { type: "EXTENSION", value: "102", name: "Front Desk Scheduling" }
  general: { type: "EXTENSION", value: "100", name: "Front Desk" }
  after_hours: { behavior: "callback_request", message: "We're closed. May I take your number for a callback?" }
  emergency: { type: "ON_CALL", value: "clin_oncall", name: "On-Call Clinician", fallback: "QUEUE:911" }

# After-Hours Config
BUSINESS_HOURS:
  timezone: "America/Chicago"
  monday: { open: "09:00", close: "17:00" }
  ...
  saturday: { closed: true }
  sunday: { closed: true }
AFTER_HOURS_BEHAVIOR: "callback_request"  # or "voicemail", "transfer_to_on_call"
```

### FeatureFlags (Toggles)
```json
{
  "jessie_escalation_emergency": true,
  "jessie_escalation_clinical": true,
  "jessie_escalation_harm_to_others": true,
  "jessie_transfer_warm_enabled": true,
  "jessie_callback_enabled": true,
  "jessie_after_hours_enabled": true
}
```

---

## Decision Matrix Summary

| Scenario | Route | Webhook | Gmail? | Sheets Tab |
|----------|-------|---------|--------|------------|
| New lead intake | Standard | lead.captured | No | Leads |
| Appointment booked | Standard | appointment.booked | No | Appointments |
| Billing question | Standard | transfer.initiated | No | Transfers |
| After-hours callback | Standard | callback.requested | No | Callbacks |
| Info request | Standard | (none) | No | (none) |
| Suicide keyword | **Escalation** | emergency.escalated | **Yes** | Emergency |
| Overdose mention | **Escalation** | emergency.escalated | **Yes** | Emergency |
| Harm to others | **Escalation** | emergency.escalated | **Yes** | Emergency |
| Panic attack (crisis) | **Escalation** | transfer.escalation | **Yes** | Transfers |
| Medication question | **Escalation** | clinical.concern | **Yes** | Clinical Notes |
| Domestic violence | **Escalation** | emergency.escalated | **Yes** | Emergency |