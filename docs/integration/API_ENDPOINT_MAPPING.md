# API Endpoint Mapping — ElevenLabs Tools → SBOS API

**Purpose:** Exact mapping from each ElevenLabs tool to the SBOS REST API endpoint(s) it invokes.
**Base URL:** `https://staging-api.sbos.health/api/v1`
**Auth:** All endpoints require `Authorization: Bearer <service-token>` + `X-Organization-Id: <org-id>`
**Note:** Tools marked `*` require new endpoint implementation (not yet in Agent 3 codebase)

---

## 1. lookup_client

| Tool Action | HTTP Method | Endpoint | Description |
|-------------|-------------|----------|-------------|
| Find by MRN | `GET` | `/clients?mrn={mrn}&organizationId={orgId}` | Exact MRN match |
| Find by phone | `GET` | `/clients?phone={phone}&organizationId={orgId}` | Phone lookup (E.164 normalized) |
| Find by email | `GET` | `/clients?email={email}&organizationId={orgId}` | Email lookup |
| Find by name+DOB | `GET` | `/clients?firstName={fn}&lastName={ln}&dateOfBirth={dob}&organizationId={orgId}` | Composite lookup |

**Implementation Notes:**
- Existing `ClientsController.findAll()` supports query params for filtering
- Add `mrn`, `phone`, `email`, `firstName`, `lastName`, `dateOfBirth` query params to `PaginationQueryDto` or create dedicated `LookupClientDto`
- Returns array; tool expects 0 or 1 result (404 if 0, 409 if >1)

**Response Mapping:**
```typescript
// GET /clients?... → { data: Client[], meta: { total } }
// Tool returns first match or error
```

---

## 2. capture_lead

| Tool Action | HTTP Method | Endpoint | Description |
|-------------|-------------|----------|-------------|
| Create lead | `POST` | `/clients` | Creates `Client` with `status=INTAKE` |

**Implementation Notes:**
- Existing `ClientsController.create()` accepts `CreateClientDto`
- Map tool fields → DTO: `mrn`, `firstName`, `lastName`, `preferredName`, `dateOfBirth`, `gender`, `pronouns`, `email`, `phone`, `status=INTAKE`
- `presentingConcern`, `insuranceCarrier`, `insuranceMemberId`, `insuranceGroupNumber` → store in `Client.notes` JSON or create `LeadIntake` related model (future)
- `source` → metadata in audit log
- Auto-generate MRN if not provided: `LEAD-{ISO-timestamp}`

**DTO Mapping:**
```typescript
CreateClientDto {
  mrn: tool.mrn ?? `LEAD-${new Date().toISOString()}`,
  firstName: tool.firstName,
  lastName: tool.lastName,
  preferredName: tool.preferredName,
  dateOfBirth: tool.dateOfBirth,
  gender: tool.gender ?? 'UNKNOWN',
  pronouns: tool.pronouns,
  email: tool.email,
  phone: tool.phone,
  status: 'INTAKE',
  primaryClinicianId: undefined // assigned later
}
```

---

## 3. create_or_request_appointment

| Tool Action | HTTP Method | Endpoint | Description |
|-------------|-------------|----------|-------------|
| Check availability | `GET` | `/scheduling/slots?clinicianId={id}&date={YYYY-MM-DD}&duration={min}` | Returns available slots |
| Book appointment | `POST` | `/appointments` | Creates appointment with conflict check |

**Implementation Notes:**
- **Check availability:** Existing `SchedulingController.getSlots()` — add `organizationId` from auth
- **Book:** Existing `AppointmentsController.create()` — accepts `CreateAppointmentDto`
- Map tool fields → DTO: `clientId`, `clinicianId`, `locationId`, `type`, `startTime`, `endTime`, `durationMinutes`, `isTelehealth`, `cptCode`
- For `action=CHECK_AVAILABILITY`: extract date from `startTime`, call `getSlots`, return formatted slots
- For `action=BOOK`: call `create`, handle 409 conflict → return available alternatives

**DTO Mapping (BOOK):**
```typescript
CreateAppointmentDto {
  clientId: tool.clientId,
  clinicianId: tool.clinicianId,
  locationId: tool.locationId,
  type: tool.type ?? 'INDIVIDUAL',
  startTime: tool.startTime,
  endTime: tool.endTime,
  durationMinutes: tool.durationMinutes ?? 50,
  isTelehealth: tool.isTelehealth ?? false,
  cptCode: tool.cptCode
}
```

---

## 4. transfer_call

| Tool Action | HTTP Method | Endpoint | Description |
|-------------|-------------|----------|-------------|
| Initiate transfer | `POST` * | `/telephony/transfers` | Creates transfer record, triggers Twilio `<Dial>` |

**Implementation Notes:**
- **NEW ENDPOINT REQUIRED** — Agent 3 must implement
- Creates `CallTransfer` record (new model) with: `organizationId`, `conversationId`, `destination`, `transferType`, `contextSummary`, `fallbackDestination`, `status=INITIATED`
- Returns `transferId`; webhook updates status to `CONNECTED`/`FAILED`/`VOICEMAIL`
- ElevenLabs receives webhook on status change (see Make webhook mapping)

**Proposed Model (Agent 3 to add):**
```prisma
model CallTransfer {
  id              String   @id @default(cuid())
  organizationId  String
  conversationId  String
  destinationType String   // EXTENSION, EXTERNAL_NUMBER, VOICEMAIL, QUEUE, ON_CALL
  destinationValue String
  destinationName String?
  transferType    String   // WARM, COLD
  contextSummary  String?
  fallbackType    String?
  fallbackValue   String?
  status          String   // INITIATED, CONNECTED, FAILED, VOICEMAIL
  connectedAt     DateTime?
  endedAt         DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([organizationId])
  @@index([conversationId])
  @@index([status])
}
```

---

## 5. send_message_or_callback_request

| Tool Action | HTTP Method | Endpoint | Description |
|-------------|-------------|----------|-------------|
| Send SMS | `POST` * | `/notifications/sms` | Sends SMS via Twilio |
| Send Email | `POST` * | `/notifications/email` | Sends email via Resend |
| Create callback task | `POST` | `/tasks` | Creates `Task` with `type=CALLBACK` |

**Implementation Notes:**
- **SMS/Email:** NEW ENDPOINTS REQUIRED — wrapper around existing `SmsProvider`/`EmailProvider`
- **Callback task:** Existing `Task` model supports this; need controller endpoint
- Map `recipient.role` → assignee lookup (find user with role in org)
- `callbackDetails` → `Task.description` JSON

**Task DTO Mapping:**
```typescript
CreateTaskDto {
  title: `Callback: ${tool.callbackDetails.callerName}`,
  description: JSON.stringify({
    callerName: tool.callbackDetails.callerName,
    callerPhone: tool.callbackDetails.callerPhone,
    bestTimeToCall: tool.callbackDetails.bestTimeToCall,
    reason: tool.callbackDetails.reason,
    priority: tool.callbackDetails.priority,
    conversationId: tool.conversationId
  }),
  clientId: tool.clientId, // if known
  assigneeId: resolvedFromRole(tool.recipient.role),
  status: 'OPEN',
  priority: tool.callbackDetails.priority ?? 'NORMAL',
  dueDate: parseBestTime(tool.callbackDetails.bestTimeToCall)
}
```

---

## 6. log_call_outcome

| Tool Action | HTTP Method | Endpoint | Description |
|-------------|-------------|----------|-------------|
| Log outcome | `PATCH` * | `/jessie/conversations/{id}/outcome` | Updates conversation with outcome |

**Implementation Notes:**
- **NEW ENDPOINT REQUIRED** — Agent 3 to add to `JessieController`
- Updates `Conversation` with outcome metadata (could add `outcome`, `summary`, `tags` fields to model)
- Alternative: Create `CallOutcome` model linked to `Conversation`
- Feeds analytics; called once at conversation end

**Proposed Model Addition (Agent 3):**
```prisma
model CallOutcome {
  id              String   @id @default(cuid())
  organizationId  String
  conversationId  String   @unique
  outcome         String   // APPOINTMENT_BOOKED, LEAD_CAPTURED, TRANSFERRED_TO_HUMAN, VOICEMAIL_LEFT, CALLBACK_REQUESTED, INFORMATION_PROVIDED, CALLER_HANGUP, ERROR
  summary         String
  appointmentId   String?
  clientId        String?
  transferDestination String?
  durationSeconds Int?
  tags            String[]
  createdAt       DateTime @default(now())

  @@index([organizationId])
  @@index([outcome])
}
```

---

## 7. get_business_information

| Tool Action | HTTP Method | Endpoint | Description |
|-------------|-------------|----------|-------------|
| Get org profile | `GET` * | `/organizations/{id}/profile` | Returns hours, location, services, insurance, clinicians |

**Implementation Notes:**
- **NEW ENDPOINT REQUIRED** — Composite view across multiple models
- Aggregates: `Organization` (hours, location), `ServiceCode` (services/pricing), `Payer` (insurance), `Clinician` (providers)
- Cache 5 minutes (Redis) — invalidate on org/service/payer/clinician updates

**Response Assembly:**
```typescript
async getOrgProfile(orgId: string) {
  const [org, services, payers, clinicians] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.serviceCode.findMany({ where: { organizationId: orgId, isActive: true } }),
    prisma.payer.findMany({ where: { organizationId: orgId, isActive: true } }),
    prisma.clinician.findMany({ where: { organizationId: orgId, isAcceptingNewClients: true }, include: { user: true } })
  ]);
  return { hours: org.businessHours, location: org, services, insurance: payers, clinicians };
}
```

---

## Endpoint Summary Table

| Tool | Existing Endpoint? | New Endpoint Needed? | Controller |
|------|-------------------|---------------------|------------|
| lookup_client | ✅ `GET /clients` (with filters) | Filters only | ClientsController |
| capture_lead | ✅ `POST /clients` | No | ClientsController |
| create_or_request_appointment (check) | ✅ `GET /scheduling/slots` | No | SchedulingController |
| create_or_request_appointment (book) | ✅ `POST /appointments` | No | AppointmentsController |
| transfer_call | ❌ | ✅ `POST /telephony/transfers` | **NEW: TelephonyController** |
| send_message_or_callback_request (SMS/email) | ❌ | ✅ `POST /notifications/sms|email` | **NEW: NotificationsController** |
| send_message_or_callback_request (callback) | ✅ `POST /tasks` | No | **NEW: TasksController** |
| log_call_outcome | ❌ | ✅ `PATCH /jessie/conversations/{id}/outcome` | JessieController |
| get_business_information | ❌ | ✅ `GET /organizations/{id}/profile` | **NEW: OrganizationsController** |

---

## Service Token Authentication

All tool→API calls use a **service token** (not user JWT):

```
Authorization: Bearer sbos-svc-jessie-elevenlabs-{env}
X-Organization-Id: {org-cuid}
Content-Type: application/json
Idempotency-Key: {tool-call-id}  // for POST/PUT idempotency
```

- Token format: `sbos-svc-jessie-elevenlabs-staging` / `sbos-svc-jessie-elevenlabs-prod`
- Issued by auth service; scoped to `jessie:tools:*` permission
- Rate limit: 100 req/min per organization (distributed rate limiter)
- Staging token stored in ElevenLabs agent config; production in secret manager