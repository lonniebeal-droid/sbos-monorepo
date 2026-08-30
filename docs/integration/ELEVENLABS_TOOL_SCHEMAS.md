# ElevenLabs Tool Schemas — Jessie AI Receptionist

**Purpose:** Exact JSON schemas for all 7 backend tool contracts ElevenLabs will invoke.
**Format:** OpenAPI 3.1 / JSON Schema Draft 2020-12
**Auth:** All tools require `Authorization: Bearer <service-token>` + `X-Organization-Id: <org-id>`
**Base URL:** `https://staging-api.sbos.health/api/v1` (staging)

---

## 1. lookup_client

**Description:** Find an existing client by MRN, phone, email, or name + DOB. Returns minimal safe fields for the conversation.

**When invoked:** Caller provides identifying info; Jessie needs to confirm identity before proceeding.

### Request Schema
```json
{
  "name": "lookup_client",
  "description": "Find an existing client by MRN, phone, email, or name + DOB",
  "parameters": {
    "type": "object",
    "properties": {
      "organizationId": { "type": "string", "format": "cuid", "description": "Jessie tenant organization ID" },
      "mrn": { "type": "string", "maxLength": 50, "description": "Medical record number" },
      "phone": { "type": "string", "maxLength": 30, "description": "Phone number (E.164 or local)" },
      "email": { "type": "string", "format": "email", "description": "Email address" },
      "firstName": { "type": "string", "maxLength": 100 },
      "lastName": { "type": "string", "maxLength": 100 },
      "dateOfBirth": { "type": "string", "format": "date", "description": "ISO 8601 date (YYYY-MM-DD)" }
    },
    "required": ["organizationId"],
    "minProperties": 2,
    "additionalProperties": false
  }
}
```

### Invocation Rules
- At least one identifier beyond `organizationId` is required
- If multiple identifiers provided, all must match the same client (AND logic)
- Returns 404 if no match; 409 if ambiguous match (multiple clients)

---

## 2. capture_lead

**Description:** Persist a new lead / prospect from intake conversation. Creates a `Client` with status `PROSPECT` or `INTAKE`.

**When invoked:** INTAKE assistant completes the 6-step intake flow; caller is not yet in system.

### Request Schema
```json
{
  "name": "capture_lead",
  "description": "Create a new lead/prospect from intake conversation",
  "parameters": {
    "type": "object",
    "properties": {
      "organizationId": { "type": "string", "format": "cuid" },
      "mrn": { "type": "string", "maxLength": 50, "description": "Auto-generated if omitted: LEAD-{timestamp}" },
      "firstName": { "type": "string", "maxLength": 100 },
      "lastName": { "type": "string", "maxLength": 100 },
      "preferredName": { "type": "string", "maxLength": 100 },
      "dateOfBirth": { "type": "string", "format": "date" },
      "gender": { "type": "string", "enum": ["MALE","FEMALE","NON_BINARY","TRANSGENDER","OTHER","UNKNOWN","DECLINED"], "default": "UNKNOWN" },
      "pronouns": { "type": "string", "maxLength": 50 },
      "email": { "type": "string", "format": "email" },
      "phone": { "type": "string", "maxLength": 30 },
      "presentingConcern": { "type": "string", "maxLength": 500, "description": "What brings them in" },
      "insuranceCarrier": { "type": "string", "maxLength": 100 },
      "insuranceMemberId": { "type": "string", "maxLength": 50 },
      "insuranceGroupNumber": { "type": "string", "maxLength": 50 },
      "source": { "type": "string", "enum": ["PHONE","CHAT","WEB_FORM","REFERRAL"], "default": "PHONE" },
      "notes": { "type": "string", "maxLength": 1000 }
    },
    "required": ["organizationId", "firstName", "lastName", "dateOfBirth"],
    "additionalProperties": false
  }
}
```

### Invocation Rules
- `mrn` auto-generated if not provided (format: `LEAD-{ISO-timestamp}`)
- `status` defaults to `INTAKE` in the database
- Returns created client with `id`, `mrn`, `status`
- Idempotent on `organizationId` + `phone` + `email` (returns existing if match)

---

## 3. create_or_request_appointment

**Description:** Check clinician availability and either book an appointment or return available slots for the caller to choose.

**When invoked:** SCHEDULING assistant has collected date/time/clinician/type preferences.

### Request Schema
```json
{
  "name": "create_or_request_appointment",
  "description": "Check availability and book appointment or return available slots",
  "parameters": {
    "type": "object",
    "properties": {
      "organizationId": { "type": "string", "format": "cuid" },
      "clientId": { "type": "string", "format": "cuid", "description": "Existing client ID (required for booking)" },
      "clinicianId": { "type": "string", "format": "cuid" },
      "locationId": { "type": "string", "format": "cuid" },
      "type": { "type": "string", "enum": ["INTAKE","INDIVIDUAL","GROUP","FAMILY","COUPLES","MEDICATION_MANAGEMENT","ASSESSMENT","TELEHEALTH","CONSULTATION"], "default": "INDIVIDUAL" },
      "startTime": { "type": "string", "format": "date-time", "description": "ISO 8601 UTC" },
      "endTime": { "type": "string", "format": "date-time", "description": "ISO 8601 UTC" },
      "durationMinutes": { "type": "integer", "minimum": 15, "maximum": 240, "default": 50 },
      "isTelehealth": { "type": "boolean", "default": false },
      "cptCode": { "type": "string", "maxLength": 10 },
      "action": { "type": "string", "enum": ["CHECK_AVAILABILITY","BOOK"], "default": "BOOK" }
    },
    "required": ["organizationId"],
    "additionalProperties": false,
    "allOf": [
      {
        "if": { "properties": { "action": { "const": "BOOK" } } },
        "then": { "required": ["clientId", "clinicianId", "startTime", "endTime"] }
      }
    ]
  }
}
```

### Invocation Rules
- If `action=CHECK_AVAILABILITY`: requires `clinicianId` + date range (via `startTime` date portion) + `durationMinutes`; returns available slots
- If `action=BOOK`: requires all booking fields; checks conflicts; returns created appointment or 409 conflict
- Timezone: all times in UTC; organization timezone used for display
- Conflict check: clinician cannot have overlapping non-cancelled appointments

---

## 4. transfer_call

**Description:** Initiate a warm transfer to a human destination (extension, external number, queue, voicemail).

**When invoked:** Caller requests human; RECEPTIONIST/INTAKE recognizes transfer intent; follows escalation config.

### Request Schema
```json
{
  "name": "transfer_call",
  "description": "Initiate warm transfer to human destination",
  "parameters": {
    "type": "object",
    "properties": {
      "organizationId": { "type": "string", "format": "cuid" },
      "conversationId": { "type": "string", "format": "cuid", "description": "Jessie conversation ID for context" },
      "destination": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "enum": ["EXTENSION","EXTERNAL_NUMBER","VOICEMAIL","QUEUE","ON_CALL"] },
          "value": { "type": "string", "description": "Extension number, E.164 phone, queue name, or on-call contact ID" },
          "name": { "type": "string", "description": "Human-readable destination name (e.g., 'Billing Dept', 'Dr. Smith')" }
        },
        "required": ["type", "value"],
        "additionalProperties": false
      },
      "transferType": { "type": "string", "enum": ["WARM","COLD"], "default": "WARM", "description": "Warm = whisper context to human before connect" },
      "contextSummary": { "type": "string", "maxLength": 500, "description": "Brief summary for warm transfer whisper" },
      "fallbackDestination": { "$ref": "#/properties/destination", "description": "Used if primary destination unavailable" }
    },
    "required": ["organizationId", "conversationId", "destination"],
    "additionalProperties": false
  }
}
```

### Invocation Rules
- `WARM` transfer: ElevenLabs holds call, delivers `contextSummary` via TTS to human, then bridges
- `COLD` transfer: Immediate SIP redirect
- If destination unavailable (busy/no answer), attempts `fallbackDestination` then voicemail
- Returns `transferId`, `status` (CONNECTED/FAILED/VOICEMAIL), `destination`

---

## 5. send_message_or_callback_request

**Description:** Send notification (SMS/email) to staff or log callback request for later follow-up.

**When invoked:** Caller requests callback; after-hours voicemail; lead captured needs human follow-up.

### Request Schema
```json
{
  "name": "send_message_or_callback_request",
  "description": "Send notification to staff or log callback request",
  "parameters": {
    "type": "object",
    "properties": {
      "organizationId": { "type": "string", "format": "cuid" },
      "conversationId": { "type": "string", "format": "cuid" },
      "type": { "type": "string", "enum": ["SMS_STAFF","EMAIL_STAFF","CALLBACK_REQUEST","VOICEMAIL_NOTIFICATION"] },
      "recipient": {
        "type": "object",
        "properties": {
          "role": { "type": "string", "enum": ["FRONT_DESK","BILLING","CLINICAL_ON_CALL","SUPERVISOR","ALL_STAFF"] },
          "userId": { "type": "string", "format": "cuid", "description": "Specific user if role not sufficient" },
          "phone": { "type": "string", "maxLength": 30 },
          "email": { "type": "string", "format": "email" }
        },
        "required": ["role"],
        "additionalProperties": false
      },
      "subject": { "type": "string", "maxLength": 200 },
      "body": { "type": "string", "maxLength": 2000 },
      "callbackDetails": {
        "type": "object",
        "properties": {
          "callerName": { "type": "string" },
          "callerPhone": { "type": "string" },
          "bestTimeToCall": { "type": "string", "description": "Free text or ISO time range" },
          "reason": { "type": "string" },
          "priority": { "type": "string", "enum": ["LOW","NORMAL","HIGH","URGENT"], "default": "NORMAL" }
        },
        "required": ["callerName", "callerPhone", "reason"],
        "additionalProperties": false
      }
    },
    "required": ["organizationId", "conversationId", "type", "recipient"],
    "additionalProperties": false,
    "allOf": [
      {
        "if": { "properties": { "type": { "const": "CALLBACK_REQUEST" } } },
        "then": { "required": ["callbackDetails"] }
      }
    ]
  }
}
```

### Invocation Rules
- `SMS_STAFF`/`EMAIL_STAFF`: Uses org-configured Twilio/Resend credentials (console fallback in staging)
- `CALLBACK_REQUEST`: Creates a `Task` in SBOS with `type=CALLBACK`, assignee per `recipient.role`
- `VOICEMAIL_NOTIFICATION`: Email with transcription (when telephony implemented)
- Returns `notificationId`, `deliveryStatus` per channel

---

## 6. log_call_outcome

**Description:** Finalize conversation with structured outcome for reporting and analytics.

**When invoked:** Conversation ends (caller hangs up, transfer completes, intake finishes).

### Request Schema
```json
{
  "name": "log_call_outcome",
  "description": "Finalize conversation with structured outcome",
  "parameters": {
    "type": "object",
    "properties": {
      "organizationId": { "type": "string", "format": "cuid" },
      "conversationId": { "type": "string", "format": "cuid" },
      "outcome": { "type": "string", "enum": ["APPOINTMENT_BOOKED","LEAD_CAPTURED","TRANSFERRED_TO_HUMAN","VOICEMAIL_LEFT","CALLBACK_REQUESTED","INFORMATION_PROVIDED","CALLER_HANGUP","ERROR"] },
      "summary": { "type": "string", "maxLength": 1000, "description": "Human-readable outcome summary" },
      "appointmentId": { "type": "string", "format": "cuid" },
      "clientId": { "type": "string", "format": "cuid" },
      "transferDestination": { "type": "string" },
      "durationSeconds": { "type": "integer", "minimum": 0 },
      "tags": { "type": "array", "items": { "type": "string" }, "maxItems": 10 }
    },
    "required": ["organizationId", "conversationId", "outcome", "summary"],
    "additionalProperties": false
  }
}
```

### Invocation Rules
- Called exactly once per conversation at termination
- Updates `Conversation` record with outcome metadata
- Feeds analytics dashboard (leads, bookings, transfers, abandonment)
- Tags used for filtering: `["emergency","after-hours","insurance-question","clinical-question"]`

---

## 7. get_business_information

**Description:** Retrieve organization-level info: hours, location, services, accepted insurance, clinicians.

**When invoked:** Caller asks "What are your hours?" or "Who takes my insurance?" — knowledge base may not have specific answer.

### Request Schema
```json
{
  "name": "get_business_information",
  "description": "Retrieve organization-level info for caller-facing questions",
  "parameters": {
    "type": "object",
    "properties": {
      "organizationId": { "type": "string", "format": "cuid" },
      "category": { "type": "string", "enum": ["HOURS","LOCATION","SERVICES","INSURANCE","CLINICIANS","PRICING","ALL"] },
      "filters": {
        "type": "object",
        "properties": {
          "serviceType": { "type": "string", "enum": ["INTAKE","INDIVIDUAL","GROUP","FAMILY","COUPLES","MEDICATION_MANAGEMENT","ASSESSMENT","TELEHEALTH","CONSULTATION"] },
          "insuranceCarrier": { "type": "string" },
          "clinicianId": { "type": "string", "format": "cuid" }
        },
        "additionalProperties": false
      }
    },
    "required": ["organizationId", "category"],
    "additionalProperties": false
  }
}
```

### Invocation Rules
- Returns structured data, not narrative — Jessie formats into natural response
- `category=ALL` returns full org profile (use sparingly — large payload)
- Data sourced from: `Organization` (hours, location), `ServiceCode` (services/pricing), `Payer` (insurance), `Clinician` (providers)
- Cached for 5 minutes per org/category in staging

---

## Common Response Envelope (All Tools)

### Success (200)
```json
{
  "success": true,
  "data": { /* tool-specific response */ },
  "requestId": "req_abc123",
  "timestamp": "2026-08-29T18:30:00.000Z"
}
```

### Error (4xx/5xx)
```json
{
  "success": false,
  "error": {
    "code": "TOOL_ERROR|VALIDATION_ERROR|NOT_FOUND|CONFLICT|UNAUTHORIZED|RATE_LIMITED|INTERNAL_ERROR",
    "message": "Human-readable error description",
    "details": { /* field-level validation errors or conflict info */ }
  },
  "requestId": "req_abc123",
  "timestamp": "2026-08-29T18:30:00.000Z"
}
```

### Tool-Specific Success Responses

#### lookup_client
```json
{
  "client": {
    "id": "cuid",
    "mrn": "SB-10247",
    "firstName": "Jordan",
    "lastName": "Mitchell",
    "preferredName": "JJ",
    "dateOfBirth": "1990-05-15",
    "status": "ACTIVE",
    "primaryClinicianId": "cuid"
  }
}
```

#### capture_lead
```json
{
  "client": {
    "id": "cuid",
    "mrn": "LEAD-20260829T183000",
    "firstName": "Jordan",
    "lastName": "Mitchell",
    "status": "INTAKE"
  }
}
```

#### create_or_request_appointment (CHECK_AVAILABILITY)
```json
{
  "slots": [
    { "startTime": "2026-08-30T14:00:00.000Z", "endTime": "2026-08-30T14:50:00.000Z", "clinicianId": "cuid", "clinicianName": "Dr. Smith" },
    { "startTime": "2026-08-30T15:00:00.000Z", "endTime": "2026-08-30T15:50:00.000Z", "clinicianId": "cuid", "clinicianName": "Dr. Smith" }
  ]
}
```

#### create_or_request_appointment (BOOK)
```json
{
  "appointment": {
    "id": "cuid",
    "clientId": "cuid",
    "clinicianId": "cuid",
    "type": "INDIVIDUAL",
    "status": "SCHEDULED",
    "startTime": "2026-08-30T14:00:00.000Z",
    "endTime": "2026-08-30T14:50:00.000Z",
    "durationMinutes": 50,
    "isTelehealth": false
  }
}
```

#### transfer_call
```json
{
  "transferId": "cuid",
  "status": "CONNECTED",
  "destination": { "type": "EXTENSION", "value": "101", "name": "Billing Dept" },
  "connectedAt": "2026-08-29T18:30:05.000Z"
}
```

#### send_message_or_callback_request
```json
{
  "notificationId": "cuid",
  "deliveryStatus": { "sms": "SENT", "email": "QUEUED" },
  "taskId": "cuid"
}
```

#### log_call_outcome
```json
{
  "conversationId": "cuid",
  "outcome": "LEAD_CAPTURED",
  "loggedAt": "2026-08-29T18:30:00.000Z"
}
```

#### get_business_information
```json
{
  "hours": { "monday": { "open": "09:00", "close": "17:00" }, ... },
  "location": { "name": "Main Office", "addressLine1": "123 Main St", "city": "Springfield", "state": "IL" },
  "services": [{ "code": "90834", "description": "Individual Therapy", "defaultFee": 150.00 }],
  "insurance": [{ "name": "Aetna", "payerId": "60054" }],
  "clinicians": [{ "id": "cuid", "name": "Dr. Smith", "specialties": ["Anxiety","Depression"] }]
}
```

---

## ElevenLabs Agent Configuration Reference

```json
{
  "agent_id": "jessie-receptionist-staging",
  "name": "Jessie Receptionist (Staging)",
  "conversation_config": {
    "agent": {
      "prompt": { "prompt": "...", "llm": "gpt-4o", "temperature": 0.3 },
      "first_message": "Hi, I'm Jessie. How can I help you today?",
      "language": "en",
      "tools": [
        { "type": "function", "function": { "name": "lookup_client", ... } },
        { "type": "function", "function": { "name": "capture_lead", ... } },
        { "type": "function", "function": { "name": "create_or_request_appointment", ... } },
        { "type": "function", "function": { "name": "transfer_call", ... } },
        { "type": "function", "function": { "name": "send_message_or_callback_request", ... } },
        { "type": "function", "function": { "name": "log_call_outcome", ... } },
        { "type": "function", "function": { "name": "get_business_information", ... } }
      ]
    },
    "tts": { "voice_id": "staging-voice-id", "model_id": "eleven_multilingual_v2" },
    "stt": { "provider": "deepgram", "model": "nova-2" }
  }
}
```