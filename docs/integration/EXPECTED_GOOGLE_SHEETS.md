# Expected Google Sheets Rows — Make Standard Route

**Purpose:** Exact column definitions and example rows for each sheet tab populated by the Standard Route Make scenario.
**Spreadsheet:** `Jessie Staging - Standard Events` (Google Sheets ID: `1abc123_staging`)
**Make Scenario:** Standard Route Webhook → Router → Google Sheets Append

---

## Sheet Structure Overview

| Tab Name | Trigger Event | Retention | Purpose |
|----------|---------------|-----------|---------|
| **Leads** | `lead.captured` | Permanent | New prospect tracking |
| **Appointments** | `appointment.booked` | Permanent | Scheduled appointment log |
| **Transfers** | `transfer.initiated` | 90 days | Transfer audit trail |
| **Callbacks** | `callback.requested` | 90 days | Follow-up task queue |
| **Conversations** | `conversation.ended` | 90 days | Analytics / volume tracking |

---

## 1. Leads Tab

**Trigger:** `lead.captured` webhook
**Append Mode:** New row at bottom
**Dedupe Key:** `Client ID` (Make filter: "Client ID does not exist")

### Columns (A–R)
| Col | Header | Type | Source Field | Example |
|-----|--------|------|--------------|---------|
| A | Timestamp | ISO 8601 UTC | `timestamp` | 2026-08-29T18:30:00.000Z |
| B | Event ID | String | `eventId` | evt_staging_001 |
| C | Client ID | CUID | `data.clientId` | cl_staging_new456 |
| D | MRN | String | `data.mrn` | LEAD-20260829T183000 |
| E | First Name | String | `data.firstName` | Alex |
| F | Last Name | String | `data.lastName` | Rivera |
| G | Preferred Name | String | `data.preferredName` | (blank) |
| H | DOB | YYYY-MM-DD | `data.dateOfBirth` | 1985-03-15 |
| I | Gender | Enum | `data.gender` | NON_BINARY |
| J | Pronouns | String | `data.pronouns` | they/them |
| K | Email | String | `data.email` | alex.rivera@email.com |
| L | Phone | E.164 | `data.phone` | +15554003030 |
| M | Presenting Concern | String | `data.presentingConcern` | Generalized anxiety, trouble sleeping... |
| N | Insurance Carrier | String | `data.insuranceCarrier` | Blue Cross Blue Shield |
| O | Insurance Member ID | String | `data.insuranceMemberId` | BCBS-123456 |
| P | Insurance Group | String | `data.insuranceGroupNumber` | (blank) |
| Q | Source | Enum | `data.source` | PHONE |
| R | Notes | String | `data.notes` | Prefers morning appointments... |
| S | Conversation Duration (s) | Integer | `data.conversationDurationSeconds` | 312 |

### Example Row 1 (Script 1: New Lead Intake)
```
2026-08-29T18:30:00.000Z | evt_staging_001 | cl_staging_new456 | LEAD-20260829T183000 | Alex | Rivera |  | 1985-03-15 | NON_BINARY | they/them | alex.rivera@email.com | +15554003030 | Generalized anxiety, trouble sleeping, panic attacks sometimes. Never been to therapy before. | Blue Cross Blue Shield | BCBS-123456 |  | PHONE | Prefers morning appointments. Available for telehealth. | 312
```

### Example Row 2 (Script 6: Medication Question — existing client, but callback creates lead-like row if new)
```
2026-08-29T19:15:00.000Z | evt_staging_008 | cl_staging_new002 | LEAD-20260829T191500 | Sam | Chen |  | 1992-07-22 | FEMALE | she/her | sam.chen@email.com | +15555004040 | Medication refill question | Aetna | AET-789012 |  | PHONE |  | 180
```

---

## 2. Appointments Tab

**Trigger:** `appointment.booked` webhook
**Append Mode:** New row at bottom
**Dedupe Key:** `Appointment ID`

### Columns (A–R)
| Col | Header | Type | Source Field | Example |
|-----|--------|------|--------------|---------|
| A | Timestamp | ISO 8601 UTC | `timestamp` | 2026-08-29T18:30:00.000Z |
| B | Event ID | String | `eventId` | evt_staging_002 |
| C | Appointment ID | CUID | `data.appointmentId` | appt_staging_789 |
| D | Client ID | CUID | `data.clientId` | cl_staging_xyz789 |
| E | Client MRN | String | `data.clientMrn` | SB-10247 |
| F | Client Name | String | `data.clientName` | Jordan Mitchell |
| G | Clinician ID | CUID | `data.clinicianId` | clin_staging_001 |
| H | Clinician Name | String | `data.clinicianName` | Dr. Sarah Smith |
| I | Location ID | CUID | `data.locationId` | loc_staging_001 |
| J | Location Name | String | `data.locationName` | Main Office |
| K | Type | Enum | `data.type` | INTAKE |
| L | Status | Enum | `data.status` | SCHEDULED |
| M | Start Time (UTC) | ISO 8601 | `data.startTime` | 2026-08-30T14:00:00.000Z |
| N | End Time (UTC) | ISO 8601 | `data.endTime` | 2026-08-30T14:50:00.000Z |
| O | Duration (min) | Integer | `data.durationMinutes` | 50 |
| P | Telehealth | Boolean | `data.isTelehealth` | FALSE |
| Q | CPT Code | String | `data.cptCode` | 90791 |
| R | Confirmation Sent | Boolean | `data.confirmationSent` | TRUE |
| S | Confirmation Channel | Enum | `data.confirmationChannel` | SMS |

### Example Row 1 (Script 2: Existing Client Books)
```
2026-08-29T18:30:00.000Z | evt_staging_002 | appt_staging_789 | cl_staging_xyz789 | SB-10247 | Jordan Mitchell | clin_staging_001 | Dr. Sarah Smith | loc_staging_001 | Main Office | INTAKE | SCHEDULED | 2026-08-30T14:00:00.000Z | 2026-08-30T14:50:00.000Z | 50 | FALSE | 90791 | TRUE | SMS
```

### Example Row 2 (Script 1 follow-up: Lead books intake after callback)
```
2026-08-30T13:00:00.000Z | evt_staging_009 | appt_staging_010 | cl_staging_new456 | LEAD-20260829T183000 | Alex Rivera | clin_staging_001 | Dr. Sarah Smith | loc_staging_001 | Main Office | INTAKE | SCHEDULED | 2026-09-02T19:00:00.000Z | 2026-09-02T19:50:00.000Z | 50 | FALSE | 90791 | TRUE | SMS
```

---

## 3. Transfers Tab

**Trigger:** `transfer.initiated` webhook (both Standard and Escalation routes)
**Append Mode:** New row at bottom
**Dedupe Key:** `Transfer ID`

### Columns (A–P)
| Col | Header | Type | Source Field | Example |
|-----|--------|------|--------------|---------|
| A | Timestamp | ISO 8601 UTC | `timestamp` | 2026-08-29T18:30:00.000Z |
| B | Event ID | String | `eventId` | evt_staging_003 |
| C | Transfer ID | CUID | `data.transferId` | xfer_staging_001 |
| D | Conversation ID | CUID | `conversationId` | conv_staging_001 |
| E | Transfer Type | Enum | `data.transferType` | WARM |
| F | Destination Type | Enum | `data.destination.type` | EXTENSION |
| G | Destination Value | String | `data.destination.value` | 101 |
| H | Destination Name | String | `data.destination.name` | Billing Department |
| I | Fallback Type | Enum | `data.fallbackDestination.type` | VOICEMAIL |
| J | Fallback Value | String | `data.fallbackDestination.value` | billing-vm |
| K | Fallback Name | String | `data.fallbackDestination.name` | Billing Voicemail |
| L | Context Summary | String | `data.contextSummary` | Caller Jordan Mitchell... |
| M | Reason | Enum | `data.reason` | (blank) |
| N | Status | Enum | `data.status` | INITIATED |
| O | Fallback Used | Boolean | `data.fallbackUsed` | FALSE |
| P | Connected At | ISO 8601 | (from webhook) | 2026-08-29T18:30:05.000Z |

### Example Row 1 (Script 3: Billing Transfer)
```
2026-08-29T18:30:00.000Z | evt_staging_003 | xfer_staging_001 | conv_staging_001 | WARM | EXTENSION | 101 | Billing Department | VOICEMAIL | billing-vm | Billing Voicemail | Caller Jordan Mitchell (SB-10247) questions invoice INV-2026-0042. Wants payment plan options. |  | INITIATED | FALSE | 2026-08-29T18:30:05.000Z
```

### Example Row 2 (Script 5: Panic Attack — Escalation Route)
```
2026-08-29T18:45:00.000Z | evt_staging_006 | xfer_staging_004 | conv_staging_005 | WARM | ON_CALL | clin_staging_oncall_001 | Dr. Emergency Coverage |  |  |  | Caller reports severe panic attack, difficulty breathing, racing heart. Requests immediate clinical support. Not a current client. | CLINICAL_CRISIS | INITIATED | FALSE | 2026-08-29T18:45:03.000Z
```

### Example Row 3 (Script 11: Transfer Fallback)
```
2026-08-29T20:00:00.000Z | evt_staging_011 | xfer_staging_005 | conv_staging_008 | WARM | EXTENSION | 101 | Billing Department | VOICEMAIL | billing-vm | Billing Voicemail | Caller Jordan Mitchell questions invoice INV-2026-0042. |  | INITIATED | TRUE | 2026-08-29T20:00:15.000Z
```

---

## 4. Callbacks Tab

**Trigger:** `callback.requested` webhook
**Append Mode:** New row at bottom
**Dedupe Key:** `Task ID`

### Columns (A–L)
| Col | Header | Type | Source Field | Example |
|-----|--------|------|--------------|---------|
| A | Timestamp | ISO 8601 UTC | `timestamp` | 2026-08-29T18:30:00.000Z |
| B | Event ID | String | `eventId` | evt_staging_004 |
| C | Task ID | CUID | `data.taskId` | task_staging_001 |
| D | Conversation ID | CUID | `conversationId` | conv_staging_001 |
| E | Caller Name | String | `data.callerName` | Alex Rivera |
| F | Caller Phone | E.164 | `data.callerPhone` | +15554003030 |
| G | Best Time to Call | String | `data.bestTimeToCall` | Tomorrow 9-11 AM |
| H | Reason | String | `data.reason` | Schedule intake appointment |
| I | Priority | Enum | `data.priority` | NORMAL |
| J | Assignee Role | Enum | `data.assigneeRole` | FRONT_DESK |
| K | Assignee ID | CUID | `data.assigneeId` | user_staging_frontdesk_001 |
| L | Due Date | ISO 8601 | `data.dueDate` | 2026-08-30T13:00:00.000Z |

### Example Row 1 (Script 1: New Lead — Callback Requested)
```
2026-08-29T18:30:00.000Z | evt_staging_004 | task_staging_001 | conv_staging_001 | Alex Rivera | +15554003030 | Tomorrow morning | Schedule intake appointment | NORMAL | FRONT_DESK | user_staging_frontdesk_001 | 2026-08-30T13:00:00.000Z
```

### Example Row 2 (Script 4: After-Hours Voicemail — Callback)
```
2026-08-29T23:00:00.000Z | evt_staging_010 | task_staging_002 | conv_staging_007 | Jordan Mitchell | +15552001010 | Tomorrow 9-11 AM | Follow-up on invoice INV-2026-0042 | NORMAL | FRONT_DESK | user_staging_frontdesk_001 | 2026-08-30T13:00:00.000Z
```

### Example Row 3 (Script 6: Medication Question — Clinical Callback)
```
2026-08-29T19:15:00.000Z | evt_staging_007 | task_staging_003 | conv_staging_006 | Jordan Mitchell | +15552001010 | This afternoon | Sertraline 100mg side effects (nausea, insomnia) - asking if should stop | HIGH | CLINICAL_ON_CALL | user_staging_clinician_001 | 2026-08-29T22:00:00.000Z
```

---

## 5. Conversations Tab (Optional Analytics)

**Trigger:** `conversation.ended` webhook (from `log_call_outcome`)
**Append Mode:** New row at bottom
**Dedupe Key:** `Conversation ID`

### Columns (A–K)
| Col | Header | Type | Source Field | Example |
|-----|--------|------|--------------|---------|
| A | Timestamp | ISO 8601 UTC | `timestamp` | 2026-08-29T18:35:12.000Z |
| B | Event ID | String | `eventId` | evt_staging_012 |
| C | Conversation ID | CUID | `conversationId` | conv_staging_001 |
| D | Outcome | Enum | `data.outcome` | LEAD_CAPTURED |
| E | Duration (s) | Integer | `data.durationSeconds` | 312 |
| F | Client ID | CUID | `data.clientId` | cl_staging_new456 |
| G | Appointment ID | CUID | `data.appointmentId` | (blank) |
| H | Transfer Destination | String | `data.transferDestination` | (blank) |
| I | Tags | CSV | `data.tags` | new-lead,anxiety,callback-requested |
| J | Assistant Kind | Enum | (from conversation) | INTAKE |
| K | Provider | String | (from conversation) | elevenlabs-gpt4o-staging |

### Example Row 1 (Script 1)
```
2026-08-29T18:35:12.000Z | evt_staging_012 | conv_staging_001 | LEAD_CAPTURED | 312 | cl_staging_new456 |  |  | new-lead,anxiety,callback-requested | INTAKE | elevenlabs-gpt4o-staging
```

### Example Row 2 (Script 4: Emergency)
```
2026-08-29T18:30:25.000Z | evt_staging_013 | conv_staging_004 | EMERGENCY | 25 |  |  | ON_CALL: Dr. Emergency Coverage | emergency,suicide,ideation-with-plan | RECEPTIONIST | elevenlabs-gpt4o-staging
```

---

## Make Scenario: Google Sheets Append Configuration

### Leads Tab
```
Module: Google Sheets > Add a Row
Spreadsheet: Jessie Staging - Standard Events
Sheet: Leads
Values: Map each column A-S from webhook payload
Options:
  - Value Input Mode: USER_ENTERED
  - Insert Mode: INSERT_ROWS (append)
Filter: {{Client ID}} not empty
Error Handling: Retry 3x, then Slack #jessie-alerts
```

### Appointments Tab
```
Module: Google Sheets > Add a Row
Spreadsheet: Jessie Staging - Standard Events
Sheet: Appointments
Values: Map each column A-S
Filter: {{Appointment ID}} not empty
```

### Transfers Tab
```
Module: Google Sheets > Add a Row
Spreadsheet: Jessie Staging - Standard Events
Sheet: Transfers
Values: Map each column A-P
Filter: {{Transfer ID}} not empty
```

### Callbacks Tab
```
Module: Google Sheets > Add a Row
Spreadsheet: Jessie Staging - Standard Events
Sheet: Callbacks
Values: Map each column A-L
Filter: {{Task ID}} not empty
```

### Conversations Tab
```
Module: Google Sheets > Add a Row
Spreadsheet: Jessie Staging - Standard Events
Sheet: Conversations
Values: Map each column A-K
Filter: {{Conversation ID}} not empty
```

---

## Verification Queries (Run in Sheets)

### Check Lead Capture
```excel
=COUNTIF(Leads!C:C, "cl_staging_new456")  // Should be 1
=FILTER(Leads!A:S, Leads!C:C="cl_staging_new456")
```

### Check Appointment Booked
```excel
=COUNTIF(Appointments!C:C, "appt_staging_789")  // Should be 1
=VLOOKUP("appt_staging_789", Appointments!C:S, 10, FALSE)  // Clinician Name
```

### Check Transfer Log
```excel
=COUNTIF(Transfers!C:C, "xfer_staging_001")  // Should be 1
=FILTER(Transfers!A:P, Transfers!C:C="xfer_staging_001")
```

### Check Callback Queue
```excel
=COUNTIF(Callbacks!C:C, "task_staging_001")  // Should be 1
=FILTER(Callbacks!A:L, Callbacks!I:I="HIGH")  // High priority callbacks
```

### Daily Volume
```excel
=COUNTIFS(Conversations!A:A, ">="&TODAY(), Conversations!A:A, "<"&TODAY()+1)
=COUNTIFS(Conversations!D:D, "LEAD_CAPTURED", Conversations!A:A, ">="&TODAY())
=COUNTIFS(Conversations!D:D, "EMERGENCY", Conversations!A:A, ">="&TODAY())
```

---

## Data Quality Rules (Enforced in Make)

| Rule | Implementation |
|------|----------------|
| No duplicate Client IDs in Leads | Filter before append |
| No duplicate Appointment IDs | Filter before append |
| No duplicate Transfer IDs | Filter before append |
| No duplicate Task IDs in Callbacks | Filter before append |
| Timestamp format validation | Regex: `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$` |
| Phone format validation | Regex: `^\+1\d{10}$` |
| Email format validation | Regex: `^[^@]+@[^@]+\.[^@]+$` |
| Required fields present | Check before append |

---

## Escalation Route Sheets (Separate Spreadsheet)

**Spreadsheet:** `Jessie Staging - Escalation Events` (Google Sheets ID: `1def456_staging`)

### Emergency Tab
| Columns | A–P (similar to Transfers + severity, trigger, keyword, onCallClinician) |
|---------|---------------------------------------------------------------------------|

### Clinical Notes Tab
| Columns | A–L (timestamp, eventId, conversationId, clientId, clientMrn, clientName, tags, primaryClinicianId, primaryClinicianName, primaryClinicianEmail, summary, outcome) |
|---------|------------------------------------------------------------------------------------------------------------------------------------------|

---

## Staging Spreadsheet Links

| Spreadsheet | ID | URL |
|-------------|-----|-----|
| Standard Events | `1abc123_staging` | `https://docs.google.com/spreadsheets/d/1abc123_staging/edit` |
| Escalation Events | `1def456_staging` | `https://docs.google.com/spreadsheets/d/1def456_staging/edit` |

**Access:** `jessie-make-sheets@sbos-project.iam.gserviceaccount.com` (Editor)
**Human Access:** Product team, Implementation leads (Commenter)