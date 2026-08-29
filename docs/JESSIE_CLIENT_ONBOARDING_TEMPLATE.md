# Jessie Client Onboarding Template

Use this template for every new Jessie client. Complete all fields before configuration begins.

---

## 1. Business Identity

| Field | Value |
|-------|-------|
| **business_name** | |
| **industry** | (e.g., behavioral health, dental, legal, HVAC, real estate) |
| **primary_contact** | Name / email / phone |
| **inbound_number** | Phone number callers will dial (must be ported or provisioned) |
| **timezone** | IANA format (e.g., America/New_York) |
| **business_hours** | JSON or structured format — see example below |

**Business Hours Example:**
```json
{
  "monday":   { "open": "09:00", "close": "17:00", "closed": false },
  "tuesday":  { "open": "09:00", "close": "17:00", "closed": false },
  "wednesday":{ "open": "09:00", "close": "17:00", "closed": false },
  "thursday": { "open": "09:00", "close": "17:00", "closed": false },
  "friday":   { "open": "09:00", "close": "15:00", "closed": false },
  "saturday": { "closed": true },
  "sunday":   { "closed": true }
}
```

---

## 2. Services & Pricing

| Field | Value |
|-------|-------|
| **services** | List of service names (e.g., "Individual Therapy", "Intake Assessment", "Medication Management") |
| **service_descriptions** | One-sentence description per service for caller-facing use |
| **pricing_rules** | Self-pay rates, insurance accepted, sliding scale, packages — whatever callers may ask |

---

## 3. Knowledge Base (FAQ)

| Field | Value |
|-------|-------|
| **faq** | Array of Q&A objects. Each entry: `question`, `answer`, `tags` (for retrieval) |

**Example:**
```json
[
  { "question": "What are your hours?", "answer": "Mon–Fri 9am–5pm, closed weekends.", "tags": ["hours", "schedule"] },
  { "question": "Do you take insurance?", "answer": "We accept Aetna, Cigna, BlueCross. Self-pay $150/session.", "tags": ["insurance", "billing"] },
  { "question": "Where are you located?", "answer": "123 Main St, Suite 200, Springfield.", "tags": ["location", "address"] }
]
```

---

## 4. Lead Capture

| Field | Value |
|-------|-------|
| **lead_questions** | Ordered list of fields to collect from new callers (e.g., name, DOB, phone, email, presenting concern, insurance carrier) |

---

## 5. Transfer Configuration

| Field | Value |
|-------|-------|
| **transfer_destinations** | List of destinations: `name`, `type` (extension, external_number, voicemail, queue), `value` (number/extension), `hours` (when active) |
| **transfer_rules** | Rules mapping caller intent to destination (e.g., "billing → billing_ext", "clinical_emergency → on_call_clinician", "after_hours → voicemail") |

---

## 6. After-Hours Behavior

| Field | Value |
|-------|-------|
| **after_hours_behavior** | One of: `voicemail`, `callback_request`, `transfer_to_on_call`, `custom_message` |
| **callback_process** | If callback_request: fields to collect, SLA for return call, who receives notification |

---

## 7. Appointment Booking

| Field | Value |
|-------|-------|
| **booking_enabled** | true / false |
| **booking_rules** | If enabled: allowed appointment types, lead time, max advance booking, clinician assignment rules, confirmation method (SMS/email) |

---

## 8. Safety & Compliance

| Field | Value |
|-------|-------|
| **restricted_statements** | Phrases Jessie must never say (e.g., "We guarantee...", "This is medical advice", "Your insurance will cover...") |
| **emergency_rules** | Keywords that trigger immediate human escalation (e.g., "suicide", "overdose", "harm to others", "crisis") |
| **escalation_contacts** | Ordered list: name, phone, email, hours — for emergency and complaint escalation |

---

## 9. Customization

| Field | Value |
|-------|-------|
| **custom_greeting** | Exact text for the opening message |
| **custom_instructions** | Additional system prompt additions (tone, brand vocabulary, specific policies) |

---

## 10. Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Client Primary Contact | | | |
| Jessie Implementation Lead | | | |
| Technical Review (if applicable) | | | |

---

## Configuration Checklist (Internal)

- [ ] Organization created in SBOS
- [ ] PromptTemplates created for each active assistant kind
- [ ] KnowledgeArticle entries published for all FAQ items
- [ ] Feature flags set for enabled capabilities
- [ ] Phone number provisioned and pointed to Jessie webhook
- [ ] Test calls completed (happy path + edge cases)
- [ ] Monitoring/logging enabled for this organization
- [ ] Client sign-off recorded