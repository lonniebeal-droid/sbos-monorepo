# Jessie — Customer One-Pager

---

## What Is Jessie?

Jessie is an AI-powered receptionist and intake assistant for behavioral health practices and professional service businesses. She answers calls and chats 24/7, collects lead information, answers common questions from your approved content, and routes callers to the right person — so your team never misses an opportunity.

Jessie runs on your terms: you control her knowledge, her tone, and her rules. No coding required.

---

## What Jessie Can Do

| Capability | Description |
|------------|-------------|
| **Answer FAQs** | Jessie responds using only your published knowledge base — hours, services, location, insurance, policies. No hallucination. |
| **Capture Leads** | Structured, multi-step intake collects name, contact details, presenting concern, insurance — ready for your team to follow up. |
| **Route Callers** | Recognizes intent (billing, clinical, scheduling, emergency) and follows your escalation rules. |
| **After-Hours Coverage** | Handles calls when your office is closed: voicemail, callback request, or on-call transfer per your config. |
| **Appointment Detail Collection** | Gathers preferred date, time, clinician, and appointment type — your team confirms and books. |
| **Multi-Language Support** | English today; additional languages with live LLM configuration. |
| **Full Conversation History** | Every interaction logged with timestamps for quality review and compliance. |

---

## How Setup Works

1. **Discovery Call** — We learn your business, call volume, common questions, and workflow.
2. **Configuration** — We create your custom greeting, load your FAQs, set your hours, and define routing rules.
3. **Review & Approve** — You review every answer, every prompt, every escalation path before launch.
4. **Test Calls** — We run 10+ test scenarios together (hours, intake, transfer, emergency, injection).
5. **Go Live** — Point your phone number to Jessie. First week: daily check-ins, rapid adjustments.
6. **Steady State** — Monthly review; update knowledge base as your practice evolves.

**Typical timeline: 2–3 weeks from kickoff to launch.**

---

## What You Provide

| Item | Format | Effort |
|------|--------|--------|
| Business name, hours, timezone, location | Simple form | 10 min |
| Services + one-sentence descriptions | List | 15 min |
| FAQ (top 20 caller questions) | Q&A pairs | 30–60 min |
| Lead capture fields (what you need from new callers) | Ordered list | 10 min |
| Transfer destinations (extensions, numbers, voicemail) | List with rules | 15 min |
| Emergency escalation contacts | Names + phones | 10 min |
| Custom greeting text | 1–2 sentences | 5 min |
| Restricted phrases (what Jessie must never say) | List | 10 min |

---

## What's Included (Core Package)

- ✅ 24/7 AI receptionist (chat + voice-ready)
- ✅ Custom knowledge base (up to 100 articles)
- ✅ 6 assistant modes: Receptionist, Scheduling, Intake, Clinical, Knowledge, General
- ✅ Versioned prompt management — you edit, Jessie updates instantly
- ✅ Lead capture with structured intake flow
- ✅ After-hours routing (voicemail / callback / on-call)
- ✅ Emergency keyword escalation
- ✅ Full conversation history + audit trail
- ✅ HIPAA-aligned technical safeguards (RBAC, encryption in transit, tenant isolation, audit logging)
- ✅ Offline mode — Jessie works even if AI provider is down

---

## What's Optional (Add-Ons)

| Add-On | Description |
|--------|-------------|
| **Live LLM Upgrade** | GPT-4o / Claude for more natural conversation (requires BAA + API key) |
| **SMS Notifications** | Lead alerts, appointment confirmations via Twilio |
| **Email Notifications** | Lead summaries, daily digests via Resend |
| **CRM Integration** | Push leads to your CRM (custom development) |
| **Advanced Analytics** | Call volume, lead conversion, knowledge gaps, fallback rate |
| **Dedicated Support** | Named CSM, faster SLA, quarterly business reviews |

---

## What's Not Yet Supported

| Feature | Status |
|---------|--------|
| **Automated Appointment Booking** | Jessie collects details; your team confirms. Automated booking via calendar sync — roadmap. |
| **Live Call Transfer** | Jessie recognizes "I need a human" and follows your rules. Warm voice transfer — requires telephony integration (roadmap). |
| **Insurance Verification** | Not implemented. |
| **Payment Collection** | Not implemented (PCI scope). |
| **Call Recording/Transcription** | Requires telephony integration (roadmap). |
| **Multi-Language (beyond English)** | Requires live LLM configuration. |
| **FHIR/HL7 EHR Integration** | Not implemented. |

---

## What Happens If Jessie Can't Answer?

1. **Knowledge Gap** — Jessie says: "I couldn't find that in our knowledge base. I can connect you with a team member who can help — would you like that?"
2. **Off-Topic Question** — Jessie politely redirects: "I can help with scheduling, intake, and questions about our practice. For other questions, I'll connect you with our team."
3. **Prompt Injection / Abuse** — Jessie ignores attempts to override her instructions and stays in character.
4. **System Failure** — If the AI provider is down, Jessie automatically switches to offline mode (deterministic, safe responses) — no downtime.

**Your team always gets the lead or the escalation. Nothing falls through the cracks.**

---

## Human Transfer & Callback Behavior

| Scenario | Jessie's Action |
|----------|-----------------|
| Caller asks for a person | Acknowledges, logs intent, triggers your escalation rule (voicemail / callback / on-call) |
| After-hours call | Follows your configured after-hours behavior |
| Emergency keyword (suicide, overdose, harm) | Immediate escalation message + notification to on-call contact |
| Callback requested | Collects name, number, best time, reason → sends alert to your team |
| Transfer destination busy/unavailable | Falls back to voicemail or next escalation contact |

---

## Privacy & Safety Positioning

- **Your data, your control** — All conversations, prompts, and knowledge stay in your tenant. No cross-client leakage.
- **No training on your data** — Jessie does not use your conversations to improve models.
- **HIPAA-aligned architecture** — Technical safeguards implemented (access control, audit logging, encryption in transit, tenant isolation). Administrative and physical safeguards + BAAs required for production PHI.
- **Audit trail** — Every AI response logged with provider, timestamp, and assistant kind.
- **Offline-first** — Jessie works without sending any data to third-party AI providers.
- **Prompt injection resistant** — System prompt cannot be overridden by user messages.

---

## Pricing (Indicative — Finalized Per Contract)

| Tier | Best For | Included |
|------|----------|----------|
| **Starter** | Solo / small practice | Up to 500 conversations/mo, 50 knowledge articles, email support |
| **Professional** | Growing practice | Up to 2,000 conversations/mo, 200 knowledge articles, SMS alerts, priority support |
| **Business** | Multi-clinician / high volume | Unlimited conversations, unlimited knowledge, custom integrations, dedicated CSM |

> **External costs not included:** Twilio (voice/SMS), OpenAI/Anthropic (LLM), Resend (email) — billed directly by provider at cost.

---

## Next Steps

1. **Schedule a discovery call** — 30 minutes, no obligation
2. **Receive a custom configuration proposal** — Based on your call volume and needs
3. **Approve and launch** — Your Jessie, your rules, your timeline

---

**Jessie is built by the SBOS team — the same platform powering behavioral health operations nationwide. Secure. Configurable. Yours.**