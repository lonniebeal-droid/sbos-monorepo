# Rollback / Unbind Procedure — Jessie Staging Integration

**Purpose:** Step-by-step procedures to safely disable, rollback, or unbind Jessie components in staging (and production) without data loss.
**SLA:** Critical rollback < 5 minutes; Full unbind < 30 minutes.
**Authority:** Any on-call engineer can execute; no approval required for staging.

---

## Quick Reference: Kill Switches

| Component | Disable Method | Time | Reversible? |
|-----------|----------------|------|-------------|
| Jessie Chat (all orgs) | Feature Flag `jessie_chat` = false | < 30 sec | ✅ Yes |
| Jessie Chat (single org) | Feature Flag `jessie_chat` = false (org-scoped) | < 30 sec | ✅ Yes |
| ElevenLabs Agent | ElevenLabs Dashboard → Agent → Disable | < 2 min | ✅ Yes |
| ElevenLabs Webhook | SBOS: Revoke service token | < 1 min | ✅ Yes |
| Make Standard Route | Make Dashboard → Scenario OFF | < 1 min | ✅ Yes |
| Make Escalation Route | Make Dashboard → Scenario OFF | < 1 min | ✅ Yes |
| Twilio Voice Webhook | Twilio Console → Phone Number → Webhook URL = empty | < 2 min | ✅ Yes |
| Database Writes | Feature Flag `jessie_write` = false | < 30 sec | ✅ Yes |

---

## Procedure 1: Emergency Jessie Disable (All Orgs)

**Trigger:** Critical bug, security incident, runaway costs, data corruption risk.
**Time:** < 30 seconds
**Impact:** All Jessie conversations stop; existing conversations readable; no new conversations.

### Steps
```bash
# 1. Disable via Feature Flag (instant, no deploy)
curl -X PATCH "https://staging-api.sbos.health/api/v1/platform/feature-flags/jessie_chat" \
  -H "Authorization: Bearer sbos-svc-admin-staging" \
  -H "Content-Type: application/json" \
  -d '{"isEnabled": false}'

# 2. Verify disabled
curl "https://staging-api.sbos.health/api/v1/platform/feature-flags/jessie_chat" \
  -H "Authorization: Bearer sbos-svc-admin-staging" \
  | jq '.isEnabled == false'

# 3. Confirm in logs (should see feature flag check failures)
# tail -f /var/log/sbos/api.log | grep "jessie_chat"
```

### Verification
- [ ] `POST /jessie/conversations` returns 403 (feature disabled)
- [ ] `GET /jessie/conversations` still works (read-only)
- [ ] Web dashboard shows "Jessie temporarily unavailable" banner
- [ ] No new Conversation records created

### Rollback (Re-enable)
```bash
curl -X PATCH "https://staging-api.sbos.health/api/v1/platform/feature-flags/jessie_chat" \
  -H "Authorization: Bearer sbos-svc-admin-staging" \
  -d '{"isEnabled": true}'
```

---

## Procedure 2: Single-Org Jessie Disable

**Trigger:** Single client issue, billing dispute, compliance hold.
**Time:** < 30 seconds
**Impact:** Only affected org disabled.

### Steps
```bash
# 1. Disable for specific org
curl -X PATCH "https://staging-api.sbos.health/api/v1/platform/feature-flags/jessie_chat" \
  -H "Authorization: Bearer sbos-svc-admin-staging" \
  -H "Content-Type: application/json" \
  -d '{"isEnabled": false, "organizationId": "org_staging_abc123"}'

# 2. Verify org-scoped
curl "https://staging-api.sbos.health/api/v1/platform/feature-flags/jessie_chat?organizationId=org_staging_abc123" \
  -H "Authorization: Bearer sbos-svc-admin-staging"
```

### Verification
- [ ] Target org: 403 on Jessie write endpoints
- [ ] Other orgs: Jessie works normally
- [ ] Audit log shows feature flag change with orgId

---

## Procedure 3: ElevenLabs Agent Unbind

**Trigger:** ElevenLabs API issues, voice quality problems, cost overrun, security concern.
**Time:** < 2 minutes
**Impact:** Voice calls fail; chat (heuristic) continues if web dashboard used.

### Steps

#### Option A: ElevenLabs Dashboard (Recommended)
1. Log into `https://elevenlabs.io/app/convai`
2. Find agent: `jessie-receptionist-staging`
3. Click **Disable** (toggle OFF)
4. Verify status: "Inactive"

#### Option B: Revoke Service Token (SBOS Side)
```bash
# 1. Revoke ElevenLabs service token
curl -X DELETE "https://staging-api.sbos.health/api/v1/auth/service-tokens/sbos-svc-jessie-elevenlabs-staging" \
  -H "Authorization: Bearer sbos-svc-admin-staging"

# 2. Verify revoked
curl "https://staging-api.sbos.health/api/v1/auth/service-tokens/sbos-svc-jessie-elevenlabs-staging" \
  -H "Authorization: Bearer sbos-svc-admin-staging" \
  | jq '.revoked == true'

# 3. ElevenLabs tool calls will now return 401
```

#### Option C: Update Webhook URL (Redirect to Null)
```bash
# In ElevenLabs agent config, set webhook URL to:
# https://httpbin.org/status/204  (silent sink)
# Or remove webhook entirely
```

### Verification
- [ ] ElevenLabs agent shows "Inactive" or webhook returns 401/204
- [ ] Test call to Twilio number → Jessie chat fallback (heuristic) or "service unavailable"
- [ ] SBOS logs show 401 on tool calls from ElevenLabs
- [ ] No tool invocations in audit log from ElevenLabs

### Rollback (Re-bind)
```bash
# 1. Re-enable agent in ElevenLabs dashboard
# 2. Or re-issue service token
curl -X POST "https://staging-api.sbos.health/api/v1/auth/service-tokens" \
  -H "Authorization: Bearer sbos-svc-admin-staging" \
  -d '{"name": "jessie-elevenlabs-staging", "scope": "jessie:tools:*", "expiresInDays": 90}'

# 3. Update ElevenLabs agent with new token
# 4. Test tool call
```

---

## Procedure 4: Make Route Disable

**Trigger:** Make scenario errors, Google Sheets API quota, Gmail failures, webhook storms.
**Time:** < 1 minute per route

### Steps (Standard Route)
1. Log into `https://www.make.com/en/scenarios`
2. Find scenario: `Jessie Standard Route - Staging`
3. Click **ON** toggle → **OFF**
4. Verify: "Scenario is paused"

### Steps (Escalation Route)
1. Find scenario: `Jessie Escalation Route - Staging`
2. Click **ON** toggle → **OFF**
3. Verify: "Scenario is paused"

### Verification
- [ ] Make execution history shows no new runs
- [ ] SBOS webhook calls return 200 but Make doesn't process
- [ ] Google Sheets no new rows
- [ ] Gmail no new sends

### Rollback
1. Click **OFF** toggle → **ON**
2. Verify immediate processing of queued webhooks (if any)

---

## Procedure 5: Twilio Voice Webhook Disable

**Trigger:** Twilio API issues, voice quality, spam attacks, cost overrun.
**Time:** < 2 minutes

### Steps
1. Log into `https://console.twilio.com`
2. Navigate: **Phone Numbers** → **Manage** → **Active Numbers**
3. Click staging number: `+15551234567`
4. **Voice Configuration** → **A Call Comes In** → **Webhook URL**
5. Clear the webhook URL (set to empty) → **Save**
6. Or set to: `https://httpbin.org/status/204`

### Verification
- [ ] Inbound call → Twilio says "Application not configured" or silence
- [ ] No webhook hits on SBOS `/webhooks/twilio/voice`
- [ ] Chat (text) Jessie still works via web dashboard

### Rollback
1. Restore webhook URL: `https://staging-api.sbos.health/api/v1/webhooks/twilio/voice`
2. Save
3. Test call connects

---

## Procedure 6: Database Write Disable (Read-Only Mode)

**Trigger:** Data corruption risk, migration rollback, audit-only mode.
**Time:** < 30 seconds

### Steps
```bash
# 1. Disable write feature flag
curl -X PATCH "https://staging-api.sbos.health/api/v1/platform/feature-flags/jessie_write" \
  -H "Authorization: Bearer sbos-svc-admin-staging" \
  -d '{"isEnabled": false}'

# 2. Verify reads work, writes fail
curl -X POST "https://staging-api.sbos.health/api/v1/jessie/conversations" \
  -H "Authorization: Bearer sbos-svc-jessie-elevenlabs-staging" \
  -H "X-Organization-Id: org_staging_abc123" \
  -d '{"kind": "RECEPTIONIST"}'
# Should return 403

curl "https://staging-api.sbos.health/api/v1/jessie/conversations" \
  -H "Authorization: Bearer sbos-svc-jessie-elevenlabs-staging" \
  -H "X-Organization-Id: org_staging_abc123"
# Should return 200 with data
```

### Rollback
```bash
curl -X PATCH "https://staging-api.sbos.health/api/v1/platform/feature-flags/jessie_write" \
  -H "Authorization: Bearer sbos-svc-admin-staging" \
  -d '{"isEnabled": true}'
```

---

## Procedure 7: Full Integration Unbind (Staging Teardown)

**Trigger:** End of staging period, major version upgrade, security decommission.
**Time:** < 30 minutes
**Impact:** Complete disconnection; all data preserved.

### Steps

#### 1. Disable All Entry Points (Parallel)
```bash
# Disable Jessie feature flags
curl -X PATCH .../feature-flags/jessie_chat -d '{"isEnabled": false}'
curl -X PATCH .../feature-flags/jessie_write -d '{"isEnabled": false}'

# Disable ElevenLabs agent (dashboard)
# Disable Make scenarios (dashboard)
# Disable Twilio webhook (console)
```

#### 2. Revoke All Service Tokens
```bash
curl -X DELETE .../auth/service-tokens/sbos-svc-jessie-elevenlabs-staging
curl -X DELETE .../auth/service-tokens/sbos-svc-jessie-make-staging
```

#### 3. Verify No Active Connections
```bash
# Check active conversations
curl .../jessie/conversations?status=ACTIVE
# Should return 0 or only CLOSED

# Check ElevenLabs tool calls (last hour)
curl .../audit/logs?entityType=ConversationMessage&since=1h
# Should show no new entries from ElevenLabs provider

# Check Make webhook deliveries (last hour)
curl .../webhook/deliveries?since=1h
# Should show 0 successful
```

#### 4. Archive Staging Data (Optional)
```bash
# Export conversations for audit
curl .../jessie/conversations?organizationId=org_staging_abc123 > staging_conversations_$(date +%Y%m%d).json

# Export audit logs
curl .../audit/logs?organizationId=org_staging_abc123 > staging_audit_$(date +%Y%m%d).json

# Store in S3/Archive bucket
```

#### 5. Confirm with Team
- [ ] Slack #jessie-ops: "Staging integration unbound at $(date)"
- [ ] All dashboards show inactive
- [ ] No alerts firing

---

## Procedure 8: Database Migration Rollback

**Trigger:** Failed migration, schema corruption, performance regression.
**Time:** < 15 minutes (Point-in-Time Recovery)

### Steps (Managed PostgreSQL - Railway/Cloud SQL/RDS)

#### Option A: Point-in-Time Recovery (Recommended)
1. Access managed DB console (Railway/Cloud SQL/RDS)
2. Select instance → **Backups** → **Point-in-Time Recovery**
3. Choose timestamp: **Before migration** (e.g., 5 min ago)
4. Restore to **new instance** (don't overwrite production)
5. Update `DATABASE_URL` to new instance
6. Run smoke tests
7. Swap DNS/connection string

#### Option B: Migration Down (If Reversible)
```bash
# Only if migration has down() and no data loss
cd packages/database
pnpm prisma migrate resolve --rolled-back "20260829_migration_name"
# WARNING: Data loss possible; verify with team first
```

### Verification
- [ ] DB connection works
- [ ] All tables present
- [ ] Data integrity checks pass
- [ ] Application boots successfully
- [ ] Health endpoints 200

---

## Procedure 9: Service Token Rotation (Emergency)

**Trigger:** Token leaked, compromised, suspected abuse.
**Time:** < 5 minutes

### Steps
```bash
# 1. Revoke compromised token IMMEDIATELY
curl -X DELETE "https://staging-api.sbos.health/api/v1/auth/service-tokens/COMPROMISED_TOKEN_ID" \
  -H "Authorization: Bearer sbos-svc-admin-staging"

# 2. Generate new token
NEW_TOKEN=$(curl -X POST "https://staging-api.sbos.health/api/v1/auth/service-tokens" \
  -H "Authorization: Bearer sbos-svc-admin-staging" \
  -d '{"name": "jessie-elevenlabs-staging-rotated", "scope": "jessie:tools:*", "expiresInDays": 90}' \
  | jq -r '.token')

# 3. Update ElevenLabs agent with new token
# Dashboard → Agent → Security → API Key → Paste $NEW_TOKEN

# 4. Update any other consumers (Make, internal scripts)
# 5. Verify new token works
curl .../jessie/conversations \
  -H "Authorization: Bearer $NEW_TOKEN" \
  -H "X-Organization-Id: org_staging_abc123"

# 6. Audit: Check for suspicious activity on old token
curl .../audit/logs?actorId=COMPROMISED_TOKEN_ID&since=24h
```

---

## Incident Communication Templates

### Slack #jessie-ops (Rollback Executed)
```
🔴 **ROLLBACK EXECUTED**
Component: Jessie Chat / ElevenLabs / Make / Twilio
Trigger: [Bug | Security | Performance | Cost]
Action: [Feature flag | Token revoke | Scenario off | Webhook clear]
Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Executed by: @engineer
Impact: [All orgs | Single org: org_xyz]
Estimated Recovery: [Time when rollback will be reverted]
Tracking: [JIRA/GitHub issue link]
```

### Slack #jessie-ops (Rollback Reverted)
```
🟢 **ROLLBACK REVERTED**
Component: Jessie Chat / ElevenLabs / Make / Twilio
Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Executed by: @engineer
Verification: [Smoke tests pass | Calls connecting | Webhooks processing]
Root Cause: [Link to post-incident review]
```

### Email to Stakeholders (If Customer-Facing Impact)
```
Subject: [INCIDENT] Jessie Staging Integration — Temporary Disablement

Team,

We have temporarily disabled the Jessie AI integration in staging due to [reason].

Impact:
- Staging voice calls: UNAVAILABLE
- Staging chat (web): UNAVAILABLE / READ-ONLY
- Production: NOT AFFECTED

Actions Taken:
- [Feature flag disabled / Token revoked / Scenario paused]

Timeline:
- Disabled: $(date -u)
- Estimated Re-enable: [time]
- Root Cause Analysis: [link/timeline]

We will update when service is restored.

— SBOS Engineering
```

---

## Runbook Index (To Be Created)

| Runbook | Location | Status |
|---------|----------|--------|
| `docs/runbooks/jessie-disable.md` | This doc §1 | ⏸️ |
| `docs/runbooks/elevenlabs-unbind.md` | This doc §3 | ⏸️ |
| `docs/runbooks/make-disable.md` | This doc §4 | ⏸️ |
| `docs/runbooks/twilio-webhook-disable.md` | This doc §5 | ⏸️ |
| `docs/runbooks/db-rollback.md` | This doc §8 | ⏸️ |
| `docs/runbooks/token-rotation.md` | This doc §9 | ⏸️ |
| `docs/runbooks/full-teardown.md` | This doc §7 | ⏸️ |

---

## Contact Escalation

| Level | Role | Contact | When |
|-------|------|---------|------|
| L1 | On-Call Engineer | PagerDuty: `jessie-oncall` | All rollbacks |
| L2 | Engineering Lead | Slack: `@eng-lead` | Rollback > 5 min or production impact |
| L3 | CTO / VP Eng | Phone: [REDACTED] | Security incident, data loss, compliance |
| L4 | Legal / Compliance | Email: `legal@sbos.health` | PHI exposure, regulatory |

---

## Testing Rollbacks (Quarterly Drill)

| Drill | Frequency | Participants | Success Criteria |
|-------|-----------|--------------|------------------|
| Jessie Feature Flag Toggle | Monthly | On-call | Disable/Enable < 30 sec |
| ElevenLabs Token Rotation | Quarterly | Agent 3 + Agent 4 | New token works < 5 min |
| Make Scenario Pause | Monthly | Agent 4 | Pause/Resume < 1 min |
| Twilio Webhook Clear | Quarterly | Telephony Lead | Clear/Restore < 2 min |
| DB Point-in-Time Recovery | Quarterly | Agent 2 + Agent 1 | Restore < 15 min, data intact |
| Full Staging Teardown | Per Release | Full Team | Unbind < 30 min, zero data loss |

**Next Drill:** Schedule in Q4 2026 sprint planning.