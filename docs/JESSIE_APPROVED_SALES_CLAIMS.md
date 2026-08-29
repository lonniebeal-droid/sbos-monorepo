# Jessie Approved Sales Claims

**Purpose:** Single source of truth for what sales, marketing, and demos may claim about Jessie.
**Rule:** If it's not on this list, don't say it. If it's CONDITIONAL, state the condition explicitly.
**Owner:** Product + Legal review before any external use.

---

## APPROVED CLAIMS (Evidence-backed, no conditions)

### Core Capabilities
- Jessie answers approved business questions using your published knowledge base
- Jessie collects caller information through structured, multi-step conversations
- Jessie captures lead intent and contact details for follow-up
- Jessie follows configured routing rules based on assistant kind (receptionist, scheduling, intake, clinical, knowledge, general)
- Jessie supports after-hours intake with configurable behavior (voicemail, callback request, custom message)
- Jessie can be configured per business with custom greetings, system prompts, and knowledge articles
- Jessie maintains conversation memory across turns within a session
- All AI actions are written to an immutable audit trail
- Jessie runs offline with a deterministic heuristic provider — zero external dependencies for demos and development

### Architecture & Deployment
- Jessie is provider-abstracted: swap the chat provider (OpenAI, Azure, local gateway, heuristic) without code changes
- Jessie is multi-tenant: complete data isolation per organization
- Jessie integrates with the SBOS platform (scheduling, billing, clinical notes) via shared API and database
- Jessie can be licensed independently of the full SBOS platform

### Security & Compliance (Technical)
- Role-based access control (6 roles) with hierarchical permissions
- Tenant-scoped data access on every query
- JWT access + refresh tokens with rotation and revocation
- MFA (TOTP) supported
- Global input validation and rate limiting
- Audit logging on all AI interactions

---

## CONDITIONAL CLAIMS (Require explicit condition statement)

| Claim | Condition (Must Be Stated) |
|-------|----------------------------|
| "Jessie uses a live LLM (GPT-4o, Claude, etc.)" | "When an OpenAI-compatible API key is configured and a BAA is executed with the provider." |
| "Jessie books appointments automatically" | "Requires the scheduling tool-calling integration (roadmap). Today Jessie collects booking details; a human confirms." |
| "Jessie transfers calls to a human" | "Requires Twilio Voice telephony integration (roadmap). Today Jessie recognizes transfer intent and follows your escalation config." |
| "Jessie creates client records from intake" | "Requires the intake-to-client API automation (roadmap). Today Jessie collects structured intake data." |
| "Jessie sends SMS confirmations" | "When Twilio credentials are configured. Default logs to console." |
| "Jessie sends email notifications" | "When Resend API key and verified domain are configured. Default logs to console." |
| "Jessie processes payments" | "When Stripe is configured with a client-side checkout flow. Default records manual payments only." |
| "Jessie is HIPAA-compliant" | "Technical safeguards are implemented (RBAC, audit, encryption in transit, tenant isolation). Administrative/physical safeguards and BAAs with subprocessors are the customer's responsibility." |
| "Jessie integrates with your CRM" | "Requires custom integration development. No pre-built CRM connectors exist today." |
| "Jessie supports voice calls" | "Requires Twilio Voice + speech-to-text + text-to-speech integration (roadmap). Not currently available." |
| "Jessie works with your calendar" | "Requires Google/Microsoft Calendar sync integration (roadmap). Not currently available." |
| "Jessie uses your brand voice" | "Via custom PromptTemplate per assistant kind. Configured by admin, no code changes." |

---

## PROHIBITED CLAIMS (Do not say — not supported by evidence)

### Absolute Prohibitions
- ❌ "Jessie never misses a call"
- ❌ "Jessie books every appointment automatically"
- ❌ "Jessie replaces your whole front desk"
- ❌ "100% accurate" / "never makes mistakes"
- ❌ "Guaranteed more sales" / "guaranteed more bookings"
- ❌ "Works with every CRM" / "integrates with everything"
- ❌ "Fully HIPAA compliant" (without the conditional qualification above)
- ❌ "Fully production ready" (without infrastructure/compliance qualifiers)
- ❌ "Jessie provides medical/legal/financial advice"
- ❌ "Jessie handles emergencies" (Jessie escalates; does not handle)
- ❌ "Zero setup" / "works out of the box with no configuration"
- ❌ "Jessie understands everything" / "human-level understanding"

### Specific Feature Prohibitions
- ❌ "Jessie can prescribe medication" / "Jessie diagnoses conditions"
- ❌ "Jessie accesses your EHR/EMR directly" (no FHIR/HL7 connectors yet)
- ❌ "Jessie syncs with Google Calendar / Outlook / Calendly" (roadmap)
- ❌ "Jessie sends automated appointment reminders" (SMS adapter exists but not wired to scheduling reminders)
- ❌ "Jessie handles insurance verification" (not implemented)
- ❌ "Jessie processes credit cards over the phone" (PCI scope; not implemented)
- ❌ "Jessie records and transcribes calls" (telephony not integrated)
- ❌ "Jessie supports 50+ languages" (English only in heuristic; LLM-dependent)

### Marketing Language Prohibitions
- ❌ "AI receptionist that thinks like a human"
- ❌ "Autonomous AI employee"
- ❌ "Set it and forget it"
- ❌ "No training required" (prompt/knowledge configuration is required)
- ❌ "Eliminates the need for front desk staff"
- ❌ "Pays for itself in X days" (no ROI data yet)

---

## SAFE ALTERNATIVES (Use these instead)

| Instead of... | Say... |
|---------------|--------|
| "Jessie never misses a call" | "Jessie handles inbound conversations 24/7 per your configuration" |
| "Jessie books appointments" | "Jessie collects booking details and routes to your scheduling workflow" |
| "Jessie replaces your front desk" | "Jessie augments your front desk with after-hours coverage and lead capture" |
| "Fully HIPAA compliant" | "Built with HIPAA technical safeguards; BAAs and admin safeguards required for production PHI" |
| "Works with every CRM" | "Jessie exposes a REST API; custom integrations can be built" |
| "Jessie understands everything" | "Jessie answers from your approved knowledge base and stays in configured lanes" |
| "Set it and forget it" | "Configured once per business; prompts and knowledge updated as needed" |

---

## CLAIM VALIDATION PROCESS

Before any external-facing material (website, deck, proposal, demo script):

1. **Check this document** — is the claim APPROVED, CONDITIONAL, or PROHIBITED?
2. **If CONDITIONAL** — include the exact condition statement from the table above
3. **If not listed** — treat as PROHIBITED until Product adds it
4. **Get sign-off** — Product lead + Legal review for new claims

---

## VERSION HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-29 | Agent 4 | Initial version based on repo evidence |