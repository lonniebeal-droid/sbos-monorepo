# Make Webhook Event Mappings — Jessie → Make

**Purpose:** Complete specification of events sent from SBOS to Make, with exact payload schemas for both Standard and Escalation routes.
**Staging Webhook URLs:**
- Standard: `https://hook.eu2.make.com/{standard-route-id}`
- Escalation: `https://hook.eu2.make.com/{escalation-route-id}`

---

## Event Types by Route

### Standard Route (Webhook 1)
| Event | Trigger | Make Action |
|-------|---------|-------------|
| `lead.captured` | `capture_lead` tool succeeds | Append row to **Leads** sheet |
| `appointment.booked` | `create_or_request_appointment` (BOOK) succeeds | Append row to **Appointments** sheet |
| `transfer.initiated` | `transfer_call` tool called (any destination) | Append row to **Transfers** sheet |
| `callback.requested` | `send_message_or_callback_request` (CALLBACK_REQUEST) | Append row to **Callbacks** sheet |
| `conversation.ended` | `log_call_outcome` called | Update **Conversations** sheet (if exists) |

### Escalation Route (Webhook 2)
| Event | Trigger | Make Action |
|-------|---------|-------------|
| `emergency.escalated` | Emergency keyword detected OR `outcome=EMERGENCY` | Send Gmail to on-call + append to **Emergency** sheet |
| `transfer.escalation` | `transfer_call` to `ON_CALL` or `QUEUE` with clinical/emergency context | Send Gmail to on-call clinician |
| `clinical.concern` | `log_call_outcome` with `tags` containing `clinical` | Send Gmail to clinical supervisor |

---

## Common Event Envelope (All Events)

```json
{
  "event": "lead.captured",
  "eventId": "evt_staging_abc123",
  "timestamp": "2026-08-29T18:30:00.000Z",
  "organizationId": "org_staging_abc123",
  "organizationName": "Springfield Behavioral Health",
  "conversationId": "conv_staging_001",
  "data": { /* event-specific payload */ }
}
```

---

## Standard Route Payloads

### 1. lead.captured
```json
{
  "event": "lead.captured",
  "eventId": "evt_staging_001",
  "timestamp": "2026-08-29T18:30:00.000Z",
  "organizationId": "org_staging_abc123",
  "organizationName": "Springfield Behavioral Health",
  "conversationId": "conv_staging_001",
  "data": {
    "clientId": "cl_staging_new456",
    "mrn": "LEAD-20260829T183000",
    "firstName": "Jordan",
    "lastName": "Mitchell",
    "preferredName": "JJ",
    "dateOfBirth": "1990-05-15",
    "gender": "NON_BINARY",
    "pronouns": "they/them",
    "email": "jordan@example.com",
    "phone": "+15552001010",
    "presentingConcern": "Generalized anxiety, difficulty sleeping",
    "insuranceCarrier": "Aetna",
    "insuranceMemberId": "AET-123456789",
    "insuranceGroupNumber": "GRP-98765",
    "source": "PHONE",
    "notes": "Prefers morning appointments. Available for telehealth.",
    "conversationDurationSeconds": 312
  }
}
```

**→ Google Sheets: Leads Tab**
| Column | Value |
|--------|-------|
| Timestamp | 2026-08-29T18:30:00.000Z |
| Event ID | evt_staging_001 |
| Client ID | cl_staging_new456 |
| MRN | LEAD-20260829T183000 |
| First Name | Jordan |
| Last Name | Mitchell |
| Preferred Name | JJ |
| DOB | 1990-05-15 |
| Gender | NON_BINARY |
| Pronouns | they/them |
| Email | jordan@example.com |
| Phone | +15552001010 |
| Presenting Concern | Generalized anxiety, difficulty sleeping |
| Insurance Carrier | Aetna |
| Insurance Member ID | AET-123456789 |
| Insurance Group | GRP-98765 |
| Source | PHONE |
| Notes | Prefers morning appointments. Available for telehealth. |
| Conversation Duration (s) | 312 |

---

### 2. appointment.booked
```json
{
  "event": "appointment.booked",
  "eventId": "evt_staging_002",
  "timestamp": "2026-08-29T18:30:00.000Z",
  "organizationId": "org_staging_abc123",
  "organizationName": "Springfield Behavioral Health",
  "conversationId": "conv_staging_001",
  "data": {
    "appointmentId": "appt_staging_789",
    "clientId": "cl_staging_xyz789",
    "clientMrn": "SB-10247",
    "clientName": "Jordan Mitchell",
    "clinicianId": "clin_staging_001",
    "clinicianName": "Dr. Sarah Smith",
    "locationId": "loc_staging_001",
    "locationName": "Main Office",
    "type": "INTAKE",
    "status": "SCHEDULED",
    "startTime": "2026-08-30T14:00:00.000Z",
    "endTime": "2026-08-30T14:50:00.000Z",
    "durationMinutes": 50,
    "isTelehealth": false,
    "cptCode": "90791",
    "confirmationSent": true,
    "confirmationChannel": "SMS"
  }
}
```

**→ Google Sheets: Appointments Tab**
| Column | Value |
|--------|-------|
| Timestamp | 2026-08-29T18:30:00.000Z |
| Event ID | evt_staging_002 |
| Appointment ID | appt_staging_789 |
| Client ID | cl_staging_xyz789 |
| Client MRN | SB-10247 |
| Client Name | Jordan Mitchell |
| Clinician ID | clin_staging_001 |
| Clinician Name | Dr. Sarah Smith |
| Location ID | loc_staging_001 |
| Location Name | Main Office |
| Type | INTAKE |
| Status | SCHEDULED |
| Start Time (UTC) | 2026-08-30T14:00:00.000Z |
| End Time (UTC) | 2026-08-30T14:50:00.000Z |
| Duration (min) | 50 |
| Telehealth | FALSE |
| CPT Code | 90791 |
| Confirmation Sent | TRUE |
| Confirmation Channel | SMS |

---

### 3. transfer.initiated
```json
{
  "event": "transfer.initiated",
  "eventId": "evt_staging_003",
  "timestamp": "2026-08-29T18:30:00.000Z",
  "organizationId": "org_staging_abc123",
  "organizationName": "Springfield Behavioral Health",
  "conversationId": "conv_staging_002",
  "data": {
    "transferId": "xfer_staging_001",
    "transferType": "WARM",
    "destination": {
      "type": "EXTENSION",
      "value": "101",
      "name": "Billing Department"
    },
    "fallbackDestination": {
      "type": "VOICEMAIL",
      "value": "billing-vm",
      "name": "Billing Voicemail"
    },
    "contextSummary": "Caller Jordan Mitchell (MRN: SB-10247) has billing question about invoice INV-2026-0042. Wants payment plan options.",
    "status": "INITIATED"
  }
}
```

**→ Google Sheets: Transfers Tab**
| Column | Value |
|--------|-------|
| Timestamp | 2026-08-29T18:30:00.000Z |
| Event ID | evt_staging_003 |
| Transfer ID | xfer_staging_001 |
| Conversation ID | conv_staging_002 |
| Transfer Type | WARM |
| Destination Type | EXTENSION |
| Destination Value | 101 |
| Destination Name | Billing Department |
| Fallback Type | VOICEMAIL |
| Fallback Value | billing-vm |
| Fallback Name | Billing Voicemail |
| Context Summary | Caller Jordan Mitchell (MRN: SB-10247) has billing question... |
| Status | INITIATED |

---

### 4. callback.requested
```json
{
  "event": "callback.requested",
  "eventId": "evt_staging_004",
  "timestamp": "2026-08-29T18:30:00.000Z",
  "organizationId": "org_staging_abc123",
  "organizationName": "Springfield Behavioral Health",
  "conversationId": "conv_staging_003",
  "data": {
    "taskId": "task_staging_001",
    "callerName": "Jordan Mitchell",
    "callerPhone": "+15552001010",
    "bestTimeToCall": "Tomorrow 9-11 AM",
    "reason": "Wants to discuss insurance coverage for couples therapy",
    "priority": "NORMAL",
    "assigneeRole": "FRONT_DESK",
    "assigneeId": "user_staging_frontdesk_001",
    "dueDate": "2026-08-30T13:00:00.000Z"
  }
}
```

**→ Google Sheets: Callbacks Tab**
| Column | Value |
|--------|-------|
| Timestamp | 2026-08-29T18:30:00.000Z |
| Event ID | evt_staging_004 |
| Task ID | task_staging_001 |
| Conversation ID | conv_staging_003 |
| Caller Name | Jordan Mitchell |
| Caller Phone | +15552001010 |
| Best Time to Call | Tomorrow 9-11 AM |
| Reason | Wants to discuss insurance coverage for couples therapy |
| Priority | NORMAL |
| Assignee Role | FRONT_DESK |
| Assignee ID | user_staging_frontdesk_001 |
| Due Date | 2026-08-30T13:00:00.000Z |

---

## Escalation Route Payloads

### 1. emergency.escalated
```json
{
  "event": "emergency.escalated",
  "eventId": "evt_staging_005",
  "timestamp": "2026-08-29T18:30:00.000Z",
  "organizationId": "org_staging_abc123",
  "organizationName": "Springfield Behavioral Health",
  "conversationId": "conv_staging_004",
  "data": {
    "severity": "CRITICAL",
    "trigger": "KEYWORD_DETECTED",
    "keyword": "suicide",
    "callerName": "Unknown",
    "callerPhone": "+15554003030",
    "clientId": null,
    "clientMrn": null,
    "conversationExcerpt": "Caller: \"I've been thinking about suicide... I don't know what to do.\"",
    "escalationPath": "ON_CALL_CLINICIAN",
    "onCallClinicianId": "clin_staging_oncall_001",
    "onCallClinicianName": "Dr. Emergency Coverage",
    "onCallPhone": "+15559998888",
    "transferred": true,
    "transferId": "xfer_staging_002"
  }
}
```

**→ Gmail (On-Call Clinician)**
```
TO: dr.emergency@springfieldbh.org
SUBJECT: [EMERGENCY] Jessie Escalation — Suicide Keyword — Springfield Behavioral Health
BODY:
---
JESSIE EMERGENCY ESCALATION
Organization: Springfield Behavioral Health
Timestamp: 2026-08-29T18:30:00.000Z
Conversation ID: conv_staging_004

TRIGGER: Keyword "suicide" detected
SEVERITY: CRITICAL

CALLER INFO:
- Phone: +15554003030
- Name: Unknown (not yet identified)
- Client ID: Not in system

CONVERSATION EXCERPT:
"Caller: \"I've been thinking about suicide... I don't know what to do.\""

ESCALATION ACTION:
- Path: ON_CALL_CLINICIAN
- Clinician: Dr. Emergency Coverage (clin_staging_oncall_001)
- Phone: +15559998888
- Transfer ID: xfer_staging_002
- Transfer Status: CONNECTED

NEXT STEPS:
1. On-call clinician has been connected via warm transfer
2. Review conversation transcript in SBOS dashboard
3. Follow organizational crisis protocol
4. Document outcome in client record (if identified)

---
This is an automated alert from Jessie AI. Do not reply to this email.
```

**→ Google Sheets: Emergency Tab**
| Column | Value |
|--------|-------|
| Timestamp | 2026-08-29T18:30:00.000Z |
| Event ID | evt_staging_005 |
| Conversation ID | conv_staging_004 |
| Severity | CRITICAL |
| Trigger | KEYWORD_DETECTED |
| Keyword | suicide |
| Caller Phone | +15554003030 |
| Caller Name | Unknown |
| Client ID | (blank) |
| Client MRN | (blank) |
| Excerpt | "I've been thinking about suicide... I don't know what to do." |
| Escalation Path | ON_CALL_CLINICIAN |
| On-Call Clinician | Dr. Emergency Coverage |
| On-Call Phone | +15559998888 |
| Transferred | TRUE |
| Transfer ID | xfer_staging_002 |

---

### 2. transfer.escalation
```json
{
  "event": "transfer.escalation",
  "eventId": "evt_staging_006",
  "timestamp": "2026-08-29T18:30:00.000Z",
  "organizationId": "org_staging_abc123",
  "organizationName": "Springfield Behavioral Health",
  "conversationId": "conv_staging_005",
  "data": {
    "transferId": "xfer_staging_003",
    "transferType": "WARM",
    "destination": {
      "type": "ON_CALL",
      "value": "clin_staging_oncall_001",
      "name": "Dr. Emergency Coverage"
    },
    "contextSummary": "Caller Alex Rivera (MRN: LEAD-20260829T183001) reports severe panic attack, requests immediate clinical support. Not currently a client.",
    "reason": "CLINICAL_CRISIS",
    "clientId": "cl_staging_new789",
    "clientMrn": "LEAD-20260829T183001",
    "callerPhone": "+15554003030"
  }
}
```

**→ Gmail (On-Call Clinician)**
```
TO: dr.emergency@springfieldbh.org
SUBJECT: [CLINICAL ESCALATION] Jessie Transfer — Panic Attack — Springfield Behavioral Health
BODY:
---
JESSIE CLINICAL ESCALATION
Organization: Springfield Behavioral Health
Timestamp: 2026-08-29T18:30:00.000Z
Conversation ID: conv_staging_005

REASON: CLINICAL_CRISIS (panic attack, immediate support requested)
TRANSFER TYPE: WARM to ON_CALL_CLINICIAN

CALLER INFO:
- Name: Alex Rivera
- Phone: +15554003030
- Client ID: cl_staging_new789 (LEAD-20260829T183001)
- Status: INTAKE (not yet active client)

CONTEXT SUMMARY:
Caller Alex Rivera (MRN: LEAD-20260829T183001) reports severe panic attack, requests immediate clinical support. Not currently a client.

TRANSFER DETAILS:
- Transfer ID: xfer_staging_003
- Destination: Dr. Emergency Coverage (clin_staging_oncall_001)
- Transfer Status: INITIATED

NEXT STEPS:
1. Accept warm transfer — Jessie will whisper context
2. Assess clinical urgency
3. If new client, complete intake post-crisis
4. Document in SBOS

---
This is an automated alert from Jessie AI. Do not reply to this email.
```

---

### 3. clinical.concern
```json
{
  "event": "clinical.concern",
  "eventId": "evt_staging_007",
  "timestamp": "2026-08-29T18:30:00.000Z",
  "organizationId": "org_staging_abc123",
  "organizationName": "Springfield Behavioral Health",
  "conversationId": "conv_staging_006",
  "data": {
    "outcome": "INFORMATION_PROVIDED",
    "summary": "Existing client Jordan Mitchell (SB-10247) asked about medication side effects. Jessie provided general info and recommended speaking with prescribing clinician.",
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

**→ Gmail (Primary Clinician)**
```
TO: dr.smith@springfieldbh.org
SUBJECT: [CLINICAL NOTE] Client Question — Jordan Mitchell (SB-10247) — Medication Side Effects
BODY:
---
JESSIE CLINICAL CONCERN NOTIFICATION
Organization: Springfield Behavioral Health
Timestamp: 2026-08-29T18:30:00.000Z
Conversation ID: conv_staging_006

CLIENT:
- Name: Jordan Mitchell
- MRN: SB-10247
- Primary Clinician: Dr. Sarah Smith

CONCERN:
Client asked about medication side effects during conversation with Jessie.
Jessie provided general information and recommended speaking with prescribing clinician.

TAGS: clinical, medication-question

RECOMMENDATION:
Review at next session or schedule brief medication follow-up.

CONVERSATION LINK: https://staging.sbos.health/conversations/conv_staging_006

---
This is an automated notification from Jessie AI. Do not reply to this email.
```

---

## Make Scenario Configuration

### Standard Route Scenario
```
1. Webhook (Custom) → Receive JSON
2. Router → Filter by event type
   ├─ lead.captured → Google Sheets: Append Row (Leads tab)
   ├─ appointment.booked → Google Sheets: Append Row (Appointments tab)
   ├─ transfer.initiated → Google Sheets: Append Row (Transfers tab)
   ├─ callback.requested → Google Sheets: Append Row (Callbacks tab)
   └─ conversation.ended → Google Sheets: Update Row (Conversations tab) [optional]
3. Error Handler → Slack #jessie-alerts on failure
```

### Escalation Route Scenario
```
1. Webhook (Custom) → Receive JSON
2. Router → Filter by event type
   ├─ emergency.escalated →
   │    ├─ Gmail: Send Email (template) → On-Call Clinician
   │    └─ Google Sheets: Append Row (Emergency tab)
   ├─ transfer.escalation →
   │    ├─ Gmail: Send Email (template) → On-Call Clinician
   │    └─ Google Sheets: Append Row (Transfers tab)
   └─ clinical.concern →
        ├─ Gmail: Send Email (template) → Primary Clinician
        └─ Google Sheets: Append Row (Clinical Notes tab)
3. Error Handler → PagerDuty + Slack #jessie-emergency
```

---

## Webhook Retry & Reliability

| Setting | Value |
|---------|-------|
| Timeout | 10 seconds |
| Retry Attempts | 3 (exponential backoff: 1s, 2s, 4s) |
| Dead Letter Queue | SBOS `WebhookDelivery` table (queryable) |
| Idempotency | `eventId` used as dedup key in Make |
| Ordering | Per-conversation FIFO (partition key: `conversationId`) |

---

## Testing Webhooks Locally

```bash
# Use ngrok to expose local Make dev endpoint
ngrok http 3000

# Update SBOS env
MAKE_STANDARD_WEBHOOK_URL=https://abc123.ngrok.io/standard
MAKE_ESCALATION_WEBHOOK_URL=https://abc123.ngrok.io/escalation

# Trigger test event from SBOS
curl -X POST "https://staging-api.sbos.health/api/v1/admin/test-webhook" \
  -H "Authorization: Bearer sbos-svc-admin-staging" \
  -H "Content-Type: application/json" \
  -d '{"route": "standard", "event": "lead.captured"}'
```