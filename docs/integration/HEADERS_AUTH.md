# Headers & Authentication Requirements

**Purpose:** Complete specification for all headers, auth schemes, and security requirements for Jessie-ElevenLabs-Make integration in staging.

---

## 1. ElevenLabs → SBOS API (Tool Calls)

### Required Headers
```http
Authorization: Bearer sbos-svc-jessie-elevenlabs-staging
X-Organization-Id: {org-cuid}
Content-Type: application/json
Idempotency-Key: {uuid-v4}          // Required for POST/PATCH/PUT
X-Request-Id: {uuid-v4}              // Echoed in response for tracing
X-Conversation-Id: {cuid}            // For audit correlation
User-Agent: ElevenLabs-Jessie/1.0
```

### Service Token Details
| Field | Value |
|-------|-------|
| **Token Format** | `sbos-svc-jessie-elevenlabs-{env}` |
| **Staging Token** | `sbos-svc-jessie-elevenlabs-staging` |
| **Production Token** | `sbos-svc-jessie-elevenlabs-prod` (in secret manager) |
| **Scope** | `jessie:tools:*` |
| **Issuer** | SBOS Auth Service (`/auth/service-tokens`) |
| **Expiry** | 90 days (rotated via CI/CD) |
| **Revocation** | Immediate on compromise |

### Token Validation (SBOS Side)
```typescript
// In AuthGuard or dedicated ServiceTokenGuard
@Get('validate-service-token')
async validate(token: string) {
  const payload = await this.authService.verifyServiceToken(token);
  // payload: { sub: 'jessie-elevenlabs', scope: 'jessie:tools:*', orgId?: string }
  if (!payload.scope.includes('jessie:tools')) throw new UnauthorizedException();
  return payload;
}
```

### Organization Scoping
- `X-Organization-Id` **must** match the organization the token is authorized for
- Cross-org requests return `403 FORBIDDEN`
- If token has no `orgId` claim (global service token), `X-Organization-Id` is required
- If token has `orgId` claim, `X-Organization-Id` must match or be omitted

---

## 2. SBOS API → ElevenLabs (Webhooks / Async Responses)

### ElevenLabs Webhook Endpoint
```
POST https://api.elevenlabs.io/v1/convai/webhooks/{webhook-id}
```

### Required Headers (SBOS → ElevenLabs)
```http
Authorization: Bearer {ELEVENLABS_API_KEY}
Content-Type: application/json
X-SBOS-Event: transfer.status|conversation.ended|tool.error
X-SBOS-Timestamp: 2026-08-29T18:30:00.000Z
X-SBOS-Signature: sha256={hmac-sha256(payload, webhook-secret)}
```

### Webhook Secret
- Configured in ElevenLabs agent settings
- Stored in SBOS secret manager as `ELEVENLABS_WEBHOOK_SECRET`
- Rotated quarterly

### Event Payloads
```json
// transfer.status
{
  "event": "transfer.status",
  "transferId": "cuid",
  "status": "CONNECTED",
  "conversationId": "cuid",
  "organizationId": "cuid",
  "timestamp": "2026-08-29T18:30:05.000Z"
}

// conversation.ended
{
  "event": "conversation.ended",
  "conversationId": "cuid",
  "organizationId": "cuid",
  "outcome": "LEAD_CAPTURED",
  "durationSeconds": 245,
  "timestamp": "2026-08-29T18:30:00.000Z"
}

// tool.error
{
  "event": "tool.error",
  "toolName": "create_or_request_appointment",
  "conversationId": "cuid",
  "organizationId": "cuid",
  "error": { "code": "CONFLICT", "message": "Clinician double-booked" },
  "timestamp": "2026-08-29T18:30:00.000Z"
}
```

---

## 3. Make Webhook Endpoints (SBOS → Make)

### Standard Route Webhook
```
POST https://hook.eu2.make.com/{standard-route-webhook-id}
```

### Escalation Route Webhook
```
POST https://hook.eu2.make.com/{escalation-route-webhook-id}
```

### Required Headers (SBOS → Make)
```http
Authorization: Bearer {MAKE_WEBHOOK_SECRET}
Content-Type: application/json
X-SBOS-Event: lead.captured|appointment.booked|transfer.initiated|emergency.escalated
X-SBOS-Organization-Id: {org-cuid}
X-SBOS-Signature: sha256={hmac-sha256(payload, make-webhook-secret)}
X-SBOS-Timestamp: 2026-08-29T18:30:00.000Z
```

### Make Webhook Secret
- One secret per route (standard vs escalation)
- Stored in SBOS secret manager: `MAKE_STANDARD_WEBHOOK_SECRET`, `MAKE_ESCALATION_WEBHOOK_SECRET`
- Also configured in Make webhook settings for signature verification

---

## 4. Make → Google Sheets / Gmail (Make Internal)

### Google Sheets
- Make uses its own OAuth2 connection to Google Workspace
- No SBOS headers involved
- Service account: `jessie-make-sheets@sbos-project.iam.gserviceaccount.com`
- Scopes: `https://www.googleapis.com/auth/spreadsheets`

### Gmail
- Make uses its own OAuth2 connection
- Service account: `jessie-make-gmail@sbos-project.iam.gserviceaccount.com`
- Scopes: `https://www.googleapis.com/auth/gmail.send`
- From address: `jessie-alerts@sbos.health` (verified domain)

---

## 5. Twilio Voice Webhooks (Telephony → SBOS)

### Inbound Call Webhook
```
POST https://staging-api.sbos.health/api/v1/webhooks/twilio/voice
```

### Required Headers (Twilio → SBOS)
```http
Content-Type: application/x-www-form-urlencoded
X-Twilio-Signature: {twilio-signature}
```

### Signature Validation
```typescript
// In TwilioWebhookGuard
validate(signature: string, url: string, params: Record<string, string>) {
  const expected = crypto
    .createHmac('sha1', process.env.TWILIO_AUTH_TOKEN)
    .update(url + Object.keys(params).sort().map(k => k + params[k]).join(''))
    .digest('base64');
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

### Twilio Credentials (Staging)
| Credential | Location |
|------------|----------|
| Account SID | `TWILIO_ACCOUNT_SID` (secret manager) |
| Auth Token | `TWILIO_AUTH_TOKEN` (secret manager) |
| Phone Number | `+15551234567` (staging number) |
| Webhook URL | `https://staging-api.sbos.health/api/v1/webhooks/twilio/voice` |

---

## 6. Rate Limiting Headers

### Response Headers (All SBOS API)
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 97
X-RateLimit-Reset: 1725043200
Retry-After: 30          // Only on 429
```

### Limits
| Tier | Requests/Minute | Burst |
|------|-----------------|-------|
| Service Token (ElevenLabs) | 100 | 20 |
| User JWT | 60 | 10 |
| Twilio Webhook | 200 | 50 |
| Make Webhook | 50 | 10 |

---

## 7. CORS Configuration (Staging)

```typescript
// main.ts
app.enableCors({
  origin: [
    'https://staging.sbos.health',
    'https://staging-api.sbos.health',
    'https://api.elevenlabs.io',
    'https://hook.eu2.make.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Authorization',
    'X-Organization-Id',
    'Content-Type',
    'Idempotency-Key',
    'X-Request-Id',
    'X-Conversation-Id',
    'X-Twilio-Signature',
    'X-SBOS-Signature'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Retry-After'
  ]
});
```

---

## 8. Security Checklist (Staging Verification)

| Check | Verified | Evidence |
|-------|----------|----------|
| Service token rotated in last 90 days | ☐ | Secret manager audit log |
| Webhook secrets unique per endpoint | ☐ | Secret manager listing |
| HMAC signature validation on all webhooks | ☐ | Unit tests pass |
| Rate limiting enforced per org | ☐ | Distributed rate limiter tests |
| CORS origins locked to staging domains | ☐ | `CORS_ORIGINS` env var |
| No credentials in code/logs | ☐ | Secret scan (trufflehog) |
| TLS 1.2+ enforced | ☐ | SSL Labs A+ |
| HSTS enabled | ☐ | Response headers |
| CSP headers present | ☐ | Helmet config |

---

## 9. Staging Environment Variables

```bash
# Service tokens
ELEVENLABS_SERVICE_TOKEN=sbos-svc-jessie-elevenlabs-staging
ELEVENLABS_WEBHOOK_SECRET=whsec_staging_abc123...

# Make
MAKE_STANDARD_WEBHOOK_SECRET=whsec_staging_std_xyz789...
MAKE_ESCALATION_WEBHOOK_SECRET=whsec_staging_esc_def456...

# Twilio
TWILIO_ACCOUNT_SID=AC_staging_xxx
TWILIO_AUTH_TOKEN=auth_staging_yyy
TWILIO_PHONE_NUMBER=+15551234567

# Internal
JESSIE_TOOL_RATE_LIMIT=100
JESSIE_TOOL_BURST=20
```

---

## 10. Error Response Headers

All error responses include:
```http
Content-Type: application/json
X-Request-Id: {uuid}
X-Error-Code: VALIDATION_ERROR|NOT_FOUND|CONFLICT|UNAUTHORIZED|RATE_LIMITED|INTERNAL_ERROR
```

Never expose stack traces or internal details in staging or production.