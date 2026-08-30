# Example Request/Response Payloads — ElevenLabs Tools

**Purpose:** Complete, copy-pasteable examples for all 7 tools — success, error, and edge cases.
**Base URL:** `https://staging-api.sbos.health/api/v1`
**Org ID:** `org_staging_abc123` (example)

---

## 1. lookup_client

### Request: Find by MRN
```bash
curl -X GET "https://staging-api.sbos.health/api/v1/clients?mrn=SB-10247&organizationId=org_staging_abc123" \
  -H "Authorization: Bearer sbos-svc-jessie-elevenlabs-staging" \
  -H "X-Organization-Id: org_staging_abc123" \
  -H "Content-Type: application/json"
```

### Response: Success (200)
```json
{
  "data": [
    {
      "id": "cl_staging_xyz789",
      "mrn": "SB-10247",
      "firstName": "Jordan",
      "lastName": "Mitchell",
      "preferredName": "JJ",
      "dateOfBirth": "1990-05-15",
      "gender": "NON_BINARY",
      "pronouns": "they/them",
      "email": "jordan@example.com",
      "phone": "+15552001010",
      "status": "ACTIVE",
      "primaryClinicianId": "clin_staging_001",
      "organizationId": "org_staging_abc123",
      "createdAt": "2026-01-15T10:30:00.000Z",
      "updatedAt": "2026-08-20T14:22:00.000Z"
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20 }
}
```

### Response: Not Found (404)
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "No client matches the provided identifiers"
  },
  "requestId": "req_abc123",
  "timestamp": "2026-08-29T18:30:00.000Z"
}
```

### Response: Ambiguous Match (409)
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Multiple clients match the provided identifiers",
    "details": { "matches": 3 }
  },
  "requestId": "req_abc124",
  "timestamp": "2026-08-29T18:30:01.000Z"
}
```

### Request: Find by Phone + DOB
```bash
curl -X GET "https://staging-api.sbos.health/api/v1/clients?phone=%2B15552001010&dateOfBirth=1990-05-15&organizationId=org_staging_abc123" \
  -H "Authorization: Bearer sbos-svc-jessie-elevenlabs-staging" \
  -H "X-Organization-Id: org_staging_abc123"
```

---

## 2. capture_lead

### Request: New Lead from Intake
```bash
curl -X POST "https://staging-api.sbos.health/api/v1/clients" \
  -H "Authorization: Bearer sbos-svc-jessie-elevenlabs-staging" \
  -H "X-Organization-Id: org_staging_abc123" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: lead-20260829-001" \
  -d '{
    "firstName": "Jordan",
    "lastName": "Mitchell",
    "preferredName": "JJ",
    "dateOfBirth": "1990-05-15",
    "gender": "NON_BINARY",
    "pronouns": "they/them",
    "email": "jordan@example.com",
    "phone": "+15552001010",
    "status": "INTAKE"
  }'
```

### Response: Success (201)
```json
{
  "id": "cl_staging_new456",
  "mrn": "LEAD-20260829T183000",
  "firstName": "Jordan",
  "lastName": "Mitchell",
  "preferredName": "JJ",
  "dateOfBirth": "1990-05-15T00:00:00.000Z",
  "gender": "NON_BINARY",
  "pronouns": "they/them",
  "email": "jordan@example.com",
  "phone": "+15552001010",
  "status": "INTAKE",
  "primaryClinicianId": null,
  "organizationId": "org_staging_abc123",
  "createdAt": "2026-08-29T18:30:00.000Z",
  "updatedAt": "2026-08-29T18:30:00.000Z"
}
```

### Response: Duplicate Lead (409) — Idempotent
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Lead with this phone/email already exists",
    "details": {
      "existingClientId": "cl_staging_xyz789",
      "existingMrn": "LEAD-20260829T183000"
    }
  },
  "requestId": "req_abc125",
  "timestamp": "2026-08-29T18:30:02.000Z"
}
```

### Response: Validation Error (400)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": {
      "dateOfBirth": "Must be a valid ISO date (YYYY-MM-DD)",
      "email": "Must be a valid email address"
    }
  },
  "requestId": "req_abc126",
  "timestamp": "2026-08-29T18:30:03.000Z"
}
```

---

## 3. create_or_request_appointment

### Request: Check Availability
```bash
curl -X GET "https://staging-api.sbos.health/api/v1/scheduling/slots?clinicianId=clin_staging_001&date=2026-08-30&duration=50" \
  -H "Authorization: Bearer sbos-svc-jessie-elevenlabs-staging" \
  -H "X-Organization-Id: org_staging_abc123"
```

### Response: Available Slots (200)
```json
{
  "data": [
    {
      "startTime": "2026-08-30T14:00:00.000Z",
      "endTime": "2026-08-30T14:50:00.000Z",
      "clinicianId": "clin_staging_001",
      "clinicianName": "Dr. Sarah Smith",
      "locationId": "loc_staging_001",
      "locationName": "Main Office"
    },
    {
      "startTime": "2026-08-30T15:00:00.000Z",
      "endTime": "2026-08-30T15:50:00.000Z",
      "clinicianId": "clin_staging_001",
      "clinicianName": "Dr. Sarah Smith",
      "locationId": "loc_staging_001",
      "locationName": "Main Office"
    },
    {
      "startTime": "2026-08-30T16:00:00.000Z",
      "endTime": "2026-08-30T16:50:00.000Z",
      "clinicianId": "clin_staging_001",
      "clinicianName": "Dr. Sarah Smith",
      "locationId": "loc_staging_001",
      "locationName": "Main Office"
    }
  ]
}
```

### Response: No Availability (200 — empty array)
```json
{ "data": [] }
```

### Request: Book Appointment
```bash
curl -X POST "https://staging-api.sbos.health/api/v1/appointments" \
  -H "Authorization: Bearer sbos-svc-jessie-elevenlabs-staging" \
  -H "X-Organization-Id: org_staging_abc123" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: appt-20260829-001" \
  -d '{
    "clientId": "cl_staging_xyz789",
    "clinicianId": "clin_staging_001",
    "locationId": "loc_staging_001",
    "type": "INTAKE",
    "startTime": "2026-08-30T14:00:00.000Z",
    "endTime": "2026-08-30T14:50:00.000Z",
    "durationMinutes": 50,
    "isTelehealth": false,
    "cptCode": "90791"
  }'
```

### Response: Booked (201)
```json
{
  "id": "appt_staging_789",
  "clientId": "cl_staging_xyz789",
  "clinicianId": "clin_staging_001",
  "locationId": "loc_staging_001",
  "type": "INTAKE",
  "status": "SCHEDULED",
  "startTime": "2026-08-30T14:00:00.000Z",
  "endTime": "2026-08-30T14:50:00.000Z",
  "durationMinutes": 50,
  "isTelehealth": false,
  "cptCode": "90791",
  "organizationId": "org_staging_abc123",
  "createdAt": "2026-08-29T18:30:00.000Z",
  "updatedAt": "2026-08-29T18:30:00.000Z"
}
```

### Response: Conflict — Clinician Double-Booked (409)
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "The clinician already has an appointment in that time window",
    "details": {
      "conflictingAppointmentId": "appt_staging_existing",
      "conflictingStartTime": "2026-08-30T14:00:00.000Z",
      "conflictingEndTime": "2026-08-30T14:50:00.000Z"
    }
  },
  "requestId": "req_abc127",
  "timestamp": "2026-08-29T18:30:05.000Z"
}
```

### Response: Invalid Time Range (400)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "endTime must be after startTime"
  },
  "requestId": "req_abc128",
  "timestamp": "2026-08-29T18:30:06.000Z"
}
```

---

## 4. transfer_call

### Request: Warm Transfer to Billing
```bash
curl -X POST "https://staging-api.sbos.health/api/v1/telephony/transfers" \
  -H "Authorization: Bearer sbos-svc-jessie-elevenlabs-staging" \
  -H "X-Organization-Id: org_staging_abc123" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: transfer-20260829-001" \
  -d '{
    "conversationId": "conv_staging_001",
    "destination": {
      "type": "EXTENSION",
      "value": "101",
      "name": "Billing Department"
    },
    "transferType": "WARM",
    "contextSummary": "Caller Jordan Mitchell (MRN: SB-10247) has billing question about invoice INV-2026-0042. They want to discuss payment plan options.",
    "fallbackDestination": {
      "type": "VOICEMAIL",
      "value": "billing-vm",
      "name": "Billing Voicemail"
    }
  }'
```

### Response: Transfer Initiated (201)
```json
{
  "transferId": "xfer_staging_001",
  "status": "INITIATED",
  "destination": { "type": "EXTENSION", "value": "101", "name": "Billing Department" },
  "transferType": "WARM",
  "conversationId": "conv_staging_001",
  "organizationId": "org_staging_abc123",
  "createdAt": "2026-08-29T18:30:00.000Z"
}
```

### Webhook: Transfer Connected (SBOS → ElevenLabs)
```json
{
  "event": "transfer.status",
  "transferId": "xfer_staging_001",
  "status": "CONNECTED",
  "conversationId": "conv_staging_001",
  "organizationId": "org_staging_abc123",
  "connectedAt": "2026-08-29T18:30:05.000Z",
  "timestamp": "2026-08-29T18:30:05.000Z"
}
```

### Webhook: Transfer Failed → Fallback (SBOS → ElevenLabs)
```json
{
  "event": "transfer.status",
  "transferId": "xfer_staging_001",
  "status": "VOICEMAIL",
  "conversationId": "conv_staging_001",
  "organizationId": "org_staging_abc123",
  "fallbackUsed": true,
  "fallbackDestination": { "type": "VOICEMAIL", "value": "billing-vm", "name": "Billing Voicemail" },
  "timestamp": "2026-08-29T18:30:30.000Z"
}
```

### Response: Invalid Destination (400)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid destination type",
    "details": { "destination.type": "Must be one of: EXTENSION, EXTERNAL_NUMBER, VOICEMAIL, QUEUE, ON_CALL" }
  },
  "requestId": "req_abc129",
  "timestamp": "2026-08-29T18:30:07.000Z"
}
```

---

## 5. send_message_or_callback_request

### Request: Callback Request
```bash
curl -X POST "https://staging-api.sbos.health/api/v1/tasks" \
  -H "Authorization: Bearer sbos-svc-jessie-elevenlabs-staging" \
  -H "X-Organization-Id: org_staging_abc123" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: callback-20260829-001" \
  -d '{
    "title": "Callback: Jordan Mitchell",
    "description": "{\"callerName\":\"Jordan Mitchell\",\"callerPhone\":\"+15552001010\",\"bestTimeToCall\":\"Tomorrow morning\",\"reason\":\"Wants to discuss insurance coverage for couples therapy\",\"priority\":\"NORMAL\",\"conversationId\":\"conv_staging_001\"}",
    "clientId": "cl_staging_xyz789",
    "assigneeId": "user_staging_frontdesk_001",
    "status": "OPEN",
    "priority": "NORMAL",
    "dueDate": "2026-08-30T13:00:00.000Z"
  }'
```

### Response: Task Created (201)
```json
{
  "id": "task_staging_001",
  "title": "Callback: Jordan Mitchell",
  "description": "{\"callerName\":\"Jordan Mitchell\",\"callerPhone\":\"+15552001010\",\"bestTimeToCall\":\"Tomorrow morning\",\"reason\":\"Wants to discuss insurance coverage for couples therapy\",\"priority\":\"NORMAL\",\"conversationId\":\"conv_staging_001\"}",
  "clientId": "cl_staging_xyz789",
  "assigneeId": "user_staging_frontdesk_001",
  "status": "OPEN",
  "priority": "NORMAL",
  "dueDate": "2026-08-30T13:00:00.000Z",
  "organizationId": "org_staging_abc123",
  "createdAt": "2026-08-29T18:30:00.000Z",
  "updatedAt": "2026-08-29T18:30:00.000Z"
}
```

### Request: SMS to Staff (New Endpoint)
```bash
curl -X POST "https://staging-api.sbos.health/api/v1/notifications/sms" \
  -H "Authorization: Bearer sbos-svc-jessie-elevenlabs-staging" \
  -H "X-Organization-Id: org_staging_abc123" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: sms-20260829-001" \
  -d '{
    "to": "+15553002020",
    "body": "Jessie Alert: New lead captured — Jordan Mitchell (+15552001010). Presenting concern: anxiety. Conversation: conv_staging_001"
  }'
```

### Response: SMS Queued (202)
```json
{
  "notificationId": "notif_staging_001",
  "channel": "SMS",
  "status": "QUEUED",
  "provider": "TWILIO",
  "to": "+15553002020",
  "timestamp": "2026-08-29T18:30:00.000Z"
}
```

---

## 6. log_call_outcome

### Request: Log Lead Captured
```bash
curl -X PATCH "https://staging-api.sbos.health/api/v1/jessie/conversations/conv_staging_001/outcome" \
  -H "Authorization: Bearer sbos-svc-jessie-elevenlabs-staging" \
  -H "X-Organization-Id: org_staging_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "outcome": "LEAD_CAPTURED",
    "summary": "New lead Jordan Mitchell captured via intake. Presenting concern: generalized anxiety. Insurance: Aetna. Callback requested for tomorrow morning.",
    "clientId": "cl_staging_new456",
    "durationSeconds": 312,
    "tags": ["new-lead", "insurance-question", "callback-requested"]
  }'
```

### Response: Outcome Logged (200)
```json
{
  "conversationId": "conv_staging_001",
  "outcome": "LEAD_CAPTURED",
  "summary": "New lead Jordan Mitchell captured via intake...",
  "clientId": "cl_staging_new456",
  "durationSeconds": 312,
  "tags": ["new-lead", "insurance-question", "callback-requested"],
  "loggedAt": "2026-08-29T18:35:12.000Z"
}
```

### Request: Log Transfer Completed
```bash
curl -X PATCH "https://staging-api.sbos.health/api/v1/jessie/conversations/conv_staging_002/outcome" \
  -H "Authorization: Bearer sbos-svc-jessie-elevenlabs-staging" \
  -H "X-Organization-Id: org_staging_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "outcome": "TRANSFERRED_TO_HUMAN",
    "summary": "Caller requested billing department. Warm transfer to extension 101 completed. Context: invoice INV-2026-0042 payment plan question.",
    "transferDestination": "EXTENSION:101 (Billing Department)",
    "durationSeconds": 145,
    "tags": ["transfer", "billing"]
  }'
```

### Response: Outcome Logged (200)
```json
{
  "conversationId": "conv_staging_002",
  "outcome": "TRANSFERRED_TO_HUMAN",
  "summary": "Caller requested billing department...",
  "transferDestination": "EXTENSION:101 (Billing Department)",
  "durationSeconds": 145,
  "tags": ["transfer", "billing"],
  "loggedAt": "2026-08-29T18:35:12.000Z"
}
```

---

## 7. get_business_information

### Request: Get Hours & Location
```bash
curl -X GET "https://staging-api.sbos.health/api/v1/organizations/org_staging_abc123/profile?category=HOURS" \
  -H "Authorization: Bearer sbos-svc-jessie-elevenlabs-staging" \
  -H "X-Organization-Id: org_staging_abc123"
```

### Response: Hours (200)
```json
{
  "category": "HOURS",
  "data": {
    "timezone": "America/Chicago",
    "hours": {
      "monday": { "open": "09:00", "close": "17:00", "closed": false },
      "tuesday": { "open": "09:00", "close": "17:00", "closed": false },
      "wednesday": { "open": "09:00", "close": "17:00", "closed": false },
      "thursday": { "open": "09:00", "close": "17:00", "closed": false },
      "friday": { "open": "09:00", "close": "15:00", "closed": false },
      "saturday": { "closed": true },
      "sunday": { "closed": true }
    },
    "afterHoursMessage": "We are currently closed. Please leave a voicemail or request a callback."
  }
}
```

### Request: Get All (for debugging)
```bash
curl -X GET "https://staging-api.sbos.health/api/v1/organizations/org_staging_abc123/profile?category=ALL" \
  -H "Authorization: Bearer sbos-svc-jessie-elevenlabs-staging" \
  -H "X-Organization-Id: org_staging_abc123"
```

### Response: All Categories (200)
```json
{
  "category": "ALL",
  "data": {
    "hours": { "timezone": "America/Chicago", "hours": { ... }, "afterHoursMessage": "..." },
    "location": { "name": "Springfield Behavioral Health", "addressLine1": "123 Main St", "city": "Springfield", "state": "IL", "postalCode": "62701", "phone": "+15551234567" },
    "services": [
      { "code": "90791", "description": "Psychiatric Diagnostic Evaluation", "defaultFee": 250.00, "type": "INTAKE" },
      { "code": "90834", "description": "Individual Psychotherapy 45min", "defaultFee": 150.00, "type": "INDIVIDUAL" },
      { "code": "90847", "description": "Family Psychotherapy 50min", "defaultFee": 180.00, "type": "FAMILY" }
    ],
    "insurance": [
      { "name": "Aetna", "payerId": "60054", "planTypes": ["HMO", "PPO"] },
      { "name": "Blue Cross Blue Shield", "payerId": "BCBSIL", "planTypes": ["PPO"] },
      { "name": "Cigna", "payerId": "62308", "planTypes": ["HMO", "PPO"] }
    ],
    "clinicians": [
      { "id": "clin_staging_001", "name": "Dr. Sarah Smith", "credentials": "MD", "specialties": ["Anxiety", "Depression", "Trauma"], "acceptingNew": true },
      { "id": "clin_staging_002", "name": "Dr. James Chen", "credentials": "PhD", "specialties": ["Couples", "Family", "CBT"], "acceptingNew": true }
    ]
  }
}
```

---

## Complete Conversation Flow Example

### Scenario: New caller → Intake → Appointment booking → Callback request

```bash
# 1. Caller starts conversation
curl -X POST "https://staging-api.sbos.health/api/v1/jessie/conversations" \
  -H "Authorization: Bearer sbos-svc-jessie-elevenlabs-staging" \
  -H "X-Organization-Id: org_staging_abc123" \
  -H "Content-Type: application/json" \
  -d '{"kind": "RECEPTIONIST", "message": "Hi, I would like to schedule an appointment"}'

# 2. ElevenLabs routes to INTAKE, collects info via conversation
# ... multi-turn conversation ...

# 3. ElevenLabs calls capture_lead
curl -X POST "https://staging-api.sbos.health/api/v1/clients" \
  -H "Authorization: Bearer sbos-svc-jessie-elevenlabs-staging" \
  -H "X-Organization-Id: org_staging_abc123" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: lead-20260829-002" \
  -d '{"firstName":"Alex","lastName":"Rivera","dateOfBirth":"1985-03-22","email":"alex@example.com","phone":"+15554003030","status":"INTAKE"}'

# 4. ElevenLabs routes to SCHEDULING, checks availability
curl -X GET "https://staging-api.sbos.health/api/v1/scheduling/slots?clinicianId=clin_staging_001&date=2026-09-01&duration=50" \
  -H "Authorization: Bearer sbos-svc-jessie-elevenlabs-staging" \
  -H "X-Organization-Id: org_staging_abc123"

# 5. Caller picks slot, ElevenLabs books
curl -X POST "https://staging-api.sbos.health/api/v1/appointments" \
  -H "Authorization: Bearer sbos-svc-jessie-elevenlabs-staging" \
  -H "X-Organization-Id: org_staging_abc123" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: appt-20260829-002" \
  -d '{"clientId":"cl_staging_new789","clinicianId":"clin_staging_001","type":"INTAKE","startTime":"2026-09-01T14:00:00.000Z","endTime":"2026-09-01T14:50:00.000Z","durationMinutes":50}'

# 6. Conversation ends, log outcome
curl -X PATCH "https://staging-api.sbos.health/api/v1/jessie/conversations/conv_staging_003/outcome" \
  -H "Authorization: Bearer sbos-svc-jessie-elevenlabs-staging" \
  -H "X-Organization-Id: org_staging_abc123" \
  -H "Content-Type: application/json" \
  -d '{"outcome":"APPOINTMENT_BOOKED","summary":"New client Alex Rivera booked intake with Dr. Smith for 2026-09-01 2:00 PM","clientId":"cl_staging_new789","appointmentId":"appt_staging_999","durationSeconds":420,"tags":["new-client","intake-booked"]}'
```