# Expected Gmail Escalation Behavior — Make Escalation Route

**Purpose:** Exact specification of Gmail messages sent by the Escalation Route Make scenario, including triggers, recipients, templates, and verification criteria.
**Make Scenario:** Escalation Route Webhook → Router → Gmail Send
**Service Account:** `jessie-make-gmail@sbos-project.iam.gserviceaccount.com`
**From Address:** `jessie-alerts@sbos.health` (verified domain, DKIM/SPF configured)

---

## Gmail Triggers by Event

| Event | Recipient(s) | Template | Priority | Retry |
|-------|--------------|----------|----------|-------|
| `emergency.escalated` | On-Call Clinician (+ Clinical Supervisor CC) | `emergency_alert` | CRITICAL | 3x (1m, 2m, 4m) |
| `transfer.escalation` | On-Call Clinician | `clinical_transfer_alert` | HIGH | 3x |
| `clinical.concern` | Primary Clinician | `clinical_concern_note` | NORMAL | 3x |

---

## 1. emergency_alert Template

**Trigger:** `emergency.escalated` webhook
**Conditions:** `data.severity == "CRITICAL"` AND `data.trigger == "KEYWORD_DETECTED"`

### Recipients
| Role | Email Source | Example |
|------|--------------|---------|
| **To** | On-Call Clinician | `data.onCallClinicianEmail` or org config `on_call_clinician_email` |
| **CC** | Clinical Supervisor | Org config `clinical_supervisor_email` |
| **BCC** | Compliance | `compliance@sbos.health` (staging) |

### Subject Line
```
[EMERGENCY] Jessie Escalation — {{keyword | uppercase}} — {{organizationName}}
```

**Example:**
```
[EMERGENCY] Jessie Escalation — SUICIDE — Springfield Behavioral Health
```

### Body Template (HTML + Plain Text)

```html
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 700px; margin: 0 auto; padding: 24px;">
  <!-- Header Banner -->
  <div style="background: #dc2626; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0; margin-bottom: 0;">
    <h1 style="margin: 0; font-size: 20px; font-weight: 700;">🚨 JESSIE EMERGENCY ESCALATION</h1>
    <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">{{organizationName}}</p>
  </div>

  <!-- Content Card -->
  <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 0 0 8px 8px; padding: 24px;">

    <!-- Metadata Grid -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td style="padding: 8px 0; font-weight: 600; color: #7f1d1d; width: 180px;">Timestamp (UTC)</td>
        <td style="padding: 8px 0; font-family: monospace;">{{timestamp}}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: 600; color: #7f1d1d;">Conversation ID</td>
        <td style="padding: 8px 0; font-family: monospace;">{{conversationId}}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: 600; color: #7f1d1d;">Event ID</td>
        <td style="padding: 8px 0; font-family: monospace;">{{eventId}}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: 600; color: #7f1d1d;">Severity</td>
        <td style="padding: 8px 0;"><span style="background: #dc2626; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">{{severity}}</span></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: 600; color: #7f1d1d;">Trigger</td>
        <td style="padding: 8px 0;">{{trigger}}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: 600; color: #7f1d1d;">Keyword Detected</td>
        <td style="padding: 8px 0; font-family: monospace; background: #fee2e2; padding: 2px 6px; border-radius: 4px;">{{keyword}}</td>
      </tr>
    </table>

    <!-- Caller Info -->
    <div style="background: white; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
      <h3 style="margin: 0 0 12px; font-size: 14px; color: #7f1d1d; text-transform: uppercase; letter-spacing: 0.5px;">Caller Information</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 0; font-weight: 600; width: 150px;">Phone</td>
          <td style="padding: 6px 0; font-family: monospace;">{{callerPhone}}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Name</td>
          <td style="padding: 6px 0;">{{callerName}}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Client ID</td>
          <td style="padding: 6px 0; font-family: monospace;">{{clientId}}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">MRN</td>
          <td style="padding: 6px 0; font-family: monospace;">{{clientMrn}}</td>
        </tr>
      </table>
    </div>

    <!-- Conversation Excerpt -->
    <div style="background: white; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
      <h3 style="margin: 0 0 12px; font-size: 14px; color: #7f1d1d; text-transform: uppercase; letter-spacing: 0.5px;">Conversation Excerpt</h3>
      <blockquote style="margin: 0; padding: 12px 16px; background: #fef2f2; border-left: 3px solid #dc2626; font-style: italic; color: #1a1a2e;">
        {{conversationExcerpt}}
      </blockquote>
    </div>

    <!-- Escalation Action -->
    <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
      <h3 style="margin: 0 0 12px; font-size: 14px; color: #9a3412; text-transform: uppercase; letter-spacing: 0.5px;">Escalation Action Taken</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 0; font-weight: 600; width: 150px;">Path</td>
          <td style="padding: 6px 0;">{{escalationPath}}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">On-Call Clinician</td>
          <td style="padding: 6px 0;">{{onCallClinicianName}}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Clinician Phone</td>
          <td style="padding: 6px 0; font-family: monospace;">{{onCallPhone}}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Transfer ID</td>
          <td style="padding: 6px 0; font-family: monospace;">{{transferId}}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Transfer Status</td>
          <td style="padding: 6px 0;">
            <span style="background: {{transferred ? '#16a34a' : '#dc2626'}}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">{{transferred ? 'CONNECTED' : 'FAILED'}}</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Next Steps -->
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px;">
      <h3 style="margin: 0 0 12px; font-size: 14px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">⚡ Immediate Next Steps</h3>
      <ol style="margin: 0; padding-left: 20px; color: #1a1a2e;">
        <li style="margin-bottom: 8px;"><strong>Accept the warm transfer</strong> — Jessie will whisper context before connecting.</li>
        <li style="margin-bottom: 8px;"><strong>Assess clinical urgency</strong> — Follow organizational crisis protocol.</li>
        <li style="margin-bottom: 8px;"><strong>Document in SBOS</strong> — Review conversation transcript at: <a href="https://staging.sbos.health/conversations/{{conversationId}}" style="color: #dc2626;">Conversation Link</a></li>
        <li style="margin-bottom: 8px;">If new client identified, complete intake post-crisis.</li>
        <li>Notify clinical supervisor if not already CC'd.</li>
      </ol>
    </div>

  </div>

  <!-- Footer -->
  <p style="margin-top: 24px; font-size: 12px; color: #6b7280; text-align: center;">
    This is an automated alert from Jessie AI (Staging).<br>
    Do not reply to this email — replies are not monitored.<br>
    <a href="https://staging.sbos.health/settings/alerts" style="color: #dc2626;">Manage alert preferences</a>
  </p>
</body>
</html>
```

### Plain Text Version
```
🚨 JESSIE EMERGENCY ESCALATION — {{organizationName}}

Timestamp (UTC): {{timestamp}}
Conversation ID: {{conversationId}}
Event ID: {{eventId}}
Severity: {{severity}}
Trigger: {{trigger}}
Keyword Detected: {{keyword}}

CALLER INFORMATION:
  Phone: {{callerPhone}}
  Name: {{callerName}}
  Client ID: {{clientId}}
  MRN: {{clientMrn}}

CONVERSATION EXCERPT:
{{conversationExcerpt}}

ESCALATION ACTION:
  Path: {{escalationPath}}
  On-Call Clinician: {{onCallClinicianName}} ({{onCallPhone}})
  Transfer ID: {{transferId}}
  Transfer Status: {{transferred ? 'CONNECTED' : 'FAILED'}}

NEXT STEPS:
1. Accept the warm transfer — Jessie will whisper context before connecting.
2. Assess clinical urgency — Follow organizational crisis protocol.
3. Document in SBOS — Conversation Link: https://staging.sbos.health/conversations/{{conversationId}}
4. If new client identified, complete intake post-crisis.
5. Notify clinical supervisor if not already CC'd.

---
This is an automated alert from Jessie AI (Staging). Do not reply.
```

---

## 2. clinical_transfer_alert Template

**Trigger:** `transfer.escalation` webhook
**Conditions:** `data.reason == "CLINICAL_CRISIS"`

### Recipients
| Role | Email Source |
|------|--------------|
| **To** | On-Call Clinician (`data.destination.value` → clinician email) |
| **CC** | Clinical Supervisor (org config) |

### Subject Line
```
[CLINICAL ESCALATION] Jessie Transfer — {{reason}} — {{organizationName}}
```

### Body Template (Key Differences from Emergency)
- **Banner Color:** `#f97316` (orange) instead of red
- **Severity Badge:** `HIGH` (orange)
- **No "Keyword Detected"** row
- **Context Summary** replaces "Conversation Excerpt"
- **Next Steps** tailored for clinical crisis (not emergency protocol)

```html
<!-- Banner -->
<div style="background: #f97316; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
  <h1 style="margin: 0; font-size: 20px;">⚠️ JESSIE CLINICAL ESCALATION</h1>
  <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">{{organizationName}}</p>
</div>

<!-- Content: Similar structure but with CLINICAL_CRISIS context -->
<!-- ... -->

<!-- Next Steps -->
<div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 16px;">
  <h3 style="margin: 0 0 12px; font-size: 14px; color: #9a3412;">⚡ Immediate Next Steps</h3>
  <ol style="margin: 0; padding-left: 20px;">
    <li><strong>Accept warm transfer</strong> — Context: {{contextSummary}}</li>
    <li><strong>Assess clinical stability</strong> — Panic attack / acute anxiety / crisis</li>
    <li><strong>If new client</strong> — Complete intake post-stabilization</li>
    <li><strong>Document in SBOS</strong> — <a href="https://staging.sbos.health/conversations/{{conversationId}}">Conversation Link</a></li>
  </ol>
</div>
```

---

## 3. clinical_concern_note Template

**Trigger:** `clinical.concern` webhook
**Conditions:** `data.tags` contains `"clinical"` or `"medication-question"`

### Recipients
| Role | Email Source |
|------|--------------|
| **To** | Primary Clinician (`data.primaryClinicianEmail`) |
| **CC** | None (unless `data.ccSupervisor == true`) |

### Subject Line
```
[CLINICAL NOTE] {{clientName}} ({{clientMrn}}) — {{tags[0] | capitalize}} — {{organizationName}}
```

### Body Template
- **Banner Color:** `#3b82f6` (blue)
- **Severity Badge:** `ROUTINE` (blue)
- **Focus:** Clinical question documentation, not urgent action
- **Tone:** Informational, not alarming

```html
<div style="background: #3b82f6; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
  <h1 style="margin: 0; font-size: 18px;">📋 JESSIE CLINICAL CONCERN NOTE</h1>
  <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">{{organizationName}}</p>
</div>

<div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 0 0 8px 8px; padding: 24px;">
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
    <tr><td style="padding: 6px 0; font-weight: 600; width: 150px;">Client</td><td style="padding: 6px 0;">{{clientName}} ({{clientMrn}})</td></tr>
    <tr><td style="padding: 6px 0; font-weight: 600;">Primary Clinician</td><td style="padding: 6px 0;">{{primaryClinicianName}}</td></tr>
    <tr><td style="padding: 6px 0; font-weight: 600;">Tags</td><td style="padding: 6px 0;">{{tags.join(', ')}}</td></tr>
    <tr><td style="padding: 6px 0; font-weight: 600;">Conversation</td><td style="padding: 6px 0;"><a href="https://staging.sbos.health/conversations/{{conversationId}}">View in SBOS</a></td></tr>
  </table>

  <div style="background: white; border: 1px solid #bfdbfe; border-radius: 6px; padding: 16px;">
    <h3 style="margin: 0 0 8px; font-size: 14px; color: #1e40af;">Summary</h3>
    <p style="margin: 0; color: #1a1a2e;">{{summary}}</p>
  </div>

  <div style="margin-top: 16px; padding: 12px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px;">
    <p style="margin: 0; font-size: 13px; color: #92400e;"><strong>Recommendation:</strong> Review at next session or schedule brief follow-up. No immediate action required.</p>
  </div>
</div>
```

---

## Make Scenario: Gmail Send Configuration

### Emergency Alert Module
```
Module: Gmail > Send an Email
Connection: jessie-make-gmail@sbos-project.iam.gserviceaccount.com
From: jessie-alerts@sbos.health
To: {{onCallClinicianEmail}}
CC: {{clinicalSupervisorEmail}}
BCC: compliance@sbos.health
Subject: [EMERGENCY] Jessie Escalation — {{keyword | uppercase}} — {{organizationName}}
Content: HTML template (above)
Attachments: None
Options:
  - Content Type: HTML
  - Track Opens: false
  - Track Clicks: false
Retry: 3 attempts, exponential backoff (1m, 2m, 4m)
Error Route: Slack #jessie-emergency + PagerDuty
```

### Clinical Transfer Alert Module
```
Module: Gmail > Send an Email
From: jessie-alerts@sbos.health
To: {{onCallClinicianEmail}}
CC: {{clinicalSupervisorEmail}}
Subject: [CLINICAL ESCALATION] Jessie Transfer — {{reason}} — {{organizationName}}
Content: clinical_transfer_alert template
Retry: 3 attempts
Error Route: Slack #jessie-emergency
```

### Clinical Concern Note Module
```
Module: Gmail > Send an Email
From: jessie-alerts@sbos.health
To: {{primaryClinicianEmail}}
Subject: [CLINICAL NOTE] {{clientName}} ({{clientMrn}}) — {{tags[0]}} — {{organizationName}}
Content: clinical_concern_note template
Retry: 3 attempts
Error Route: Slack #jessie-alerts
```

---

## Gmail Verification Criteria (Staging)

### Per-Event Checks

| Event | Verify | Method |
|-------|--------|--------|
| `emergency.escalated` | Email sent to on-call clinician | Check Gmail Sent folder / Make execution log |
| `emergency.escalated` | CC to clinical supervisor | Check CC field |
| `emergency.escalated` | BCC to compliance | Check BCC field |
| `emergency.escalated` | Subject contains keyword | Regex: `\[EMERGENCY\].*SUICIDE\|OVERDOSE\|HARM` |
| `emergency.escalated` | Body includes conversation excerpt | Search for excerpt text |
| `emergency.escalated` | Body includes transfer status | Check for "CONNECTED" or "FAILED" |
| `emergency.escalated` | Conversation link valid | Click link → opens SBOS staging conversation |
| `transfer.escalation` | Email to on-call clinician | Check To field |
| `transfer.escalation` | Subject contains CLINICAL ESCALATION | Regex: `\[CLINICAL ESCALATION\]` |
| `clinical.concern` | Email to primary clinician | Check To field matches clinician email |
| `clinical.concern` | No CC unless configured | Verify CC empty |
| `clinical.concern` | Subject contains client MRN | Regex: `SB-\d+` or `LEAD-` |

### Delivery Verification
```bash
# Check Make execution history
curl "https://api.eu2.make.com/v1/scenarios/{scenario-id}/executions" \
  -H "Authorization: Bearer $MAKE_API_KEY" \
  | jq '.[] | select(.status == "success") | {event: .data.event, emailSent: .modules.gmail.status}'

# Check Gmail API (service account)
curl "https://gmail.googleapis.com/gmail/v1/users/me/messages/sent" \
  -H "Authorization: Bearer $GMAIL_SERVICE_ACCOUNT_TOKEN" \
  | jq '.messages[] | select(.subject | contains("Jessie"))'
```

---

## Staging Gmail Test Addresses

| Role | Staging Email | Production Email |
|------|---------------|------------------|
| On-Call Clinician | `dr.oncall+staging@springfieldbh.org` | `dr.oncall@springfieldbh.org` |
| Clinical Supervisor | `dr.supervisor+staging@springfieldbh.org` | `dr.supervisor@springfieldbh.org` |
| Primary Clinician (Dr. Smith) | `dr.smith+staging@springfieldbh.org` | `dr.smith@springfieldbh.org` |
| Compliance BCC | `compliance+staging@sbos.health` | `compliance@sbos.health` |
| From Address | `jessie-alerts@staging.sbos.health` | `jessie-alerts@sbos.health` |

**Note:** Use `+staging` subaddressing to isolate test emails in clinician inboxes.

---

## Error Handling & Dead Letter

| Failure Mode | Behavior |
|--------------|----------|
| Gmail API 429 (rate limit) | Exponential backoff retry (max 3) |
| Gmail API 401/403 (auth) | Alert Slack #jessie-emergency + PagerDuty |
| Invalid recipient email | Log error, skip send, alert Slack |
| Template rendering error | Log error, send plain-text fallback, alert |
| Network timeout (10s) | Retry 2x, then dead letter |

### Dead Letter Queue (SBOS)
```sql
-- Query failed Gmail deliveries
SELECT * FROM "WebhookDelivery"
WHERE "eventType" IN ('emergency.escalated', 'transfer.escalation', 'clinical.concern')
  AND "status" = 'FAILED'
  AND "attempts" >= 3
ORDER BY "createdAt" DESC;
```

---

## Compliance Notes

| Requirement | Implementation |
|-------------|----------------|
| No PHI in subject line | Only keyword + org name |
| Minimal PHI in body | Only what's needed for clinical action |
| Encryption in transit | Gmail API uses TLS 1.2+ |
| Audit trail | Make execution log + SBOS WebhookDelivery table |
| Retention | Emails retained per Google Workspace policy (30 days trash, then purge) |
| Access control | Service account only; no human credentials in Make |